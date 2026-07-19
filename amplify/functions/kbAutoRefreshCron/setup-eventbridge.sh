#!/usr/bin/env bash
#
# One-time setup for the KB Auto-Refresh cron (Lambda + EventBridge rate(1 hour)).
# Run this on a machine with AWS CLI v2 configured for the Zudobot account.
#
# It mirrors the existing dailyCheckCron setup. The simplest path REUSES the
# IAM execution role that dailyCheckCron already uses (basic Lambda logging is
# all this function needs — it only makes an outbound HTTPS call).
#
# Usage:
#   1. Fill in the three values below.
#   2. bash setup-eventbridge.sh
#
set -euo pipefail

# ─── EDIT THESE ───────────────────────────────────────────────────────────────
REGION="ap-southeast-2"                                  # Sydney (per INFRASTRUCTURE.md)
APP_URL="https://zudobot.zudogu.com"                     # production domain
INTERNAL_CRON_SECRET="<PASTE_SAME_VALUE_AS_AMPLIFY_ENV>" # must match the Next.js env var
ROLE_ARN="<PASTE_dailyCheckCron_EXECUTION_ROLE_ARN>"     # reuse dailyCheckCron's role ARN
# ───────────────────────────────────────────────────────────────────────────────

FN_NAME="kbAutoRefreshCron"
RULE_NAME="kbAutoRefreshHourly"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Packaging Lambda from $SCRIPT_DIR/index.js"
TMP_ZIP="$(mktemp -d)/function.zip"
(cd "$SCRIPT_DIR" && zip -q -j "$TMP_ZIP" index.js)

echo "==> Creating (or updating) Lambda function: $FN_NAME"
if aws lambda get-function --function-name "$FN_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FN_NAME" --zip-file "fileb://$TMP_ZIP" --region "$REGION" >/dev/null
else
  aws lambda create-function \
    --function-name "$FN_NAME" \
    --runtime nodejs18.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --timeout 90 \
    --zip-file "fileb://$TMP_ZIP" \
    --region "$REGION" >/dev/null
fi

echo "==> Setting environment variables"
aws lambda update-function-configuration \
  --function-name "$FN_NAME" \
  --environment "Variables={APP_URL=$APP_URL,INTERNAL_CRON_SECRET=$INTERNAL_CRON_SECRET}" \
  --region "$REGION" >/dev/null

echo "==> Creating EventBridge rule: $RULE_NAME (rate(1 hour))"
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(1 hour)" \
  --state ENABLED \
  --region "$REGION" >/dev/null

FN_ARN="$(aws lambda get-function --function-name "$FN_NAME" --region "$REGION" \
  --query 'Configuration.FunctionArn' --output text)"

echo "==> Granting EventBridge permission to invoke the Lambda"
RULE_ARN="$(aws events describe-rule --name "$RULE_NAME" --region "$REGION" \
  --query 'Arn' --output text)"
aws lambda add-permission \
  --function-name "$FN_NAME" \
  --statement-id "${RULE_NAME}-invoke" \
  --action "lambda:InvokeFunction" \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" \
  --region "$REGION" >/dev/null 2>&1 || echo "    (permission already exists — ok)"

echo "==> Wiring the rule to the Lambda target"
aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id=1,Arn=$FN_ARN" \
  --region "$REGION" >/dev/null

echo ""
echo "✅ Done. $FN_NAME will run every hour and call $APP_URL/api/cron/kb-auto-refresh"
echo "   Verify now with a manual invoke:"
echo "   aws lambda invoke --function-name $FN_NAME --region $REGION /dev/stdout"
