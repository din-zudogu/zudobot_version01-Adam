#!/usr/bin/env bash
#
# One-time setup for all zudobot scheduled crons on AWS (run in CloudShell).
# Creates a single cron-dispatcher Lambda + one EventBridge rule per cron.
#
# These crons live in vercel.json today, which AWS Amplify does NOT run — so they
# have never fired. This wires them to EventBridge (the same mechanism as the
# working dailyCheckCron). Re-running is safe (idempotent).
#
# REQUIRED — export these before running:
#   export APP_URL="https://zudobot.zudogu.com"
#   export INTERNAL_CRON_SECRET="<the value from Amplify Console>"
#   export REGION="ap-southeast-2"   # optional, defaults below
#
set -uo pipefail
cd "$(dirname "$0")"

REGION="${REGION:-ap-southeast-2}"
FN="zudobot-cron-dispatcher"
ROLE_NAME="zudobot-cron-dispatcher-role"

: "${APP_URL:?export APP_URL first}"
: "${INTERNAL_CRON_SECRET:?export INTERNAL_CRON_SECRET first (value from Amplify Console)}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "==> Account $ACCOUNT_ID / region $REGION"

# 1. IAM role (Lambda basic execution) ---------------------------------
echo "==> IAM role $ROLE_NAME"
aws iam create-role --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  >/dev/null 2>&1 && echo "   created" || echo "   already exists"
aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null 2>&1 || true
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"

# 2. Package + create/update the Lambda --------------------------------
echo "==> Packaging Lambda"
zip -q -FS function.zip index.js
ENV_VARS="Variables={APP_URL=$APP_URL,INTERNAL_CRON_SECRET=$INTERNAL_CRON_SECRET}"

if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Updating Lambda $FN"
  aws lambda update-function-code --function-name "$FN" --zip-file fileb://function.zip --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FN" --environment "$ENV_VARS" --timeout 30 --region "$REGION" >/dev/null
else
  echo "==> Creating Lambda $FN (waiting for role to propagate...)"
  sleep 12
  aws lambda create-function --function-name "$FN" \
    --runtime nodejs20.x --role "$ROLE_ARN" --handler index.handler --timeout 30 \
    --zip-file fileb://function.zip --environment "$ENV_VARS" --region "$REGION" >/dev/null
fi
aws lambda wait function-updated --function-name "$FN" --region "$REGION" 2>/dev/null || true
FN_ARN="$(aws lambda get-function --function-name "$FN" --query 'Configuration.FunctionArn' --output text --region "$REGION")"
echo "   $FN_ARN"

# 3. One EventBridge rule per cron -------------------------------------
# NOTE: daily-check is already handled by the existing dailyCheckCron Lambda — not here.
# If you previously ran kbAutoRefreshCron/setup-eventbridge.sh, delete that rule to
# avoid running kb-auto-refresh twice.
echo "==> EventBridge rules"
while IFS='|' read -r name sched path; do
  [ -z "$name" ] && continue
  RULE="zudobot-cron-$name"
  aws events put-rule --name "$RULE" --schedule-expression "$sched" --state ENABLED --region "$REGION" >/dev/null
  aws lambda add-permission --function-name "$FN" --statement-id "evt-$name" \
    --action lambda:InvokeFunction --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/$RULE" --region "$REGION" >/dev/null 2>&1 || true
  printf '[{"Id":"1","Arn":"%s","Input":"{\\"path\\":\\"%s\\"}"}]' "$FN_ARN" "$path" > /tmp/cron-target.json
  aws events put-targets --rule "$RULE" --targets file:///tmp/cron-target.json --region "$REGION" >/dev/null
  echo "   ✅ $RULE  $sched  $path"
done <<'TABLE'
delete-tenant|cron(0 0 * * ? *)|/api/cron/delete-tenant
partner-billing|cron(0 0 28 * ? *)|/api/cron/partner-billing
global-chat-backup|cron(59 16 * * ? *)|/api/cron/global-chat-backup
vip-sync|cron(0 1 * * ? *)|/api/cron/vip-sync
kb-auto-refresh|rate(1 hour)|/api/cron/kb-auto-refresh
few-shot-extract|rate(6 hours)|/api/cron/few-shot-extract
order-relay|rate(5 minutes)|/api/cron/order-relay
TABLE

echo ""
echo "✅ Done. Test one now:"
echo "   aws lambda invoke --function-name $FN --region $REGION --payload '{\"path\":\"/api/cron/order-relay\"}' --cli-binary-format raw-in-base64-out /tmp/out.json && cat /tmp/out.json"
