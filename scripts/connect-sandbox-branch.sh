#!/usr/bin/env bash
# Connect the `zdbsandbox` git branch to AWS Amplify as a dev environment.
#
# Run this in AWS CloudShell (ap-southeast-2) — credentials are automatic.
#
# Usage:
#   bash scripts/connect-sandbox-branch.sh

set -euo pipefail

APP_ID="d2upr1fu32ov02"
REGION="ap-southeast-2"
SOURCE_BRANCH="master"
SANDBOX_BRANCH="zdbsandbox"
SANDBOX_URL="https://zdbsandbox.zudogu.com"

TMPDIR="/tmp/amplify-sandbox"
mkdir -p "$TMPDIR"

# ── 1. Fetch all env vars from master → file (ไม่ผ่าน shell variable) ─────────

echo "[1/3] Fetching env vars from '${SOURCE_BRANCH}' (app ${APP_ID})..."

aws amplify get-branch \
  --app-id "$APP_ID" \
  --branch-name "$SOURCE_BRANCH" \
  --region "$REGION" \
  --query 'branch.environmentVariables' \
  --output json > "$TMPDIR/env-raw.json"

# Handle null (branch มี env vars ว่าง)
if ! jq -e . "$TMPDIR/env-raw.json" >/dev/null 2>&1 \
    || [ "$(cat "$TMPDIR/env-raw.json")" = "null" ]; then
  echo '{}' > "$TMPDIR/env-raw.json"
fi

KEY_COUNT=$(jq 'length' "$TMPDIR/env-raw.json")
echo "      ✓ Found ${KEY_COUNT} env vars"

# ── 2. Apply sandbox URL overrides → file ─────────────────────────────────────

jq --arg url "$SANDBOX_URL" \
  '. + {AUTH_URL: $url, NEXT_PUBLIC_APP_URL: $url, NEXT_PUBLIC_URL: $url}' \
  "$TMPDIR/env-raw.json" > "$TMPDIR/env-sandbox.json"

# ── 3. Check if branch exists ─────────────────────────────────────────────────

echo "[2/3] Checking if '${SANDBOX_BRANCH}' exists in Amplify..."

BRANCH_EXISTS=false
if aws amplify get-branch \
    --app-id "$APP_ID" \
    --branch-name "$SANDBOX_BRANCH" \
    --region "$REGION" \
    --output text > /dev/null 2>&1; then
  BRANCH_EXISTS=true
  echo "      Branch already connected — will update env vars."
else
  echo "      Branch not connected yet — will create."
fi

# ── 4. Create or update branch ────────────────────────────────────────────────

echo "[3/3] $([ "$BRANCH_EXISTS" = "true" ] && echo "Updating" || echo "Creating") branch '${SANDBOX_BRANCH}'..."

if [ "$BRANCH_EXISTS" = "true" ]; then
  jq -n \
    --arg appId "$APP_ID" \
    --arg branchName "$SANDBOX_BRANCH" \
    --slurpfile envVars "$TMPDIR/env-sandbox.json" \
    '{
      appId: $appId,
      branchName: $branchName,
      environmentVariables: $envVars[0],
      enableAutoBuild: true
    }' > "$TMPDIR/amplify-input.json"
else
  jq -n \
    --arg appId "$APP_ID" \
    --arg branchName "$SANDBOX_BRANCH" \
    --slurpfile envVars "$TMPDIR/env-sandbox.json" \
    '{
      appId: $appId,
      branchName: $branchName,
      environmentVariables: $envVars[0],
      enableAutoBuild: true,
      framework: "Next.js - SSR",
      stage: "DEVELOPMENT",
      description: "Development/testing environment"
    }' > "$TMPDIR/amplify-input.json"
fi

if [ "$BRANCH_EXISTS" = "true" ]; then
  aws amplify update-branch \
    --cli-input-json "file://$TMPDIR/amplify-input.json" \
    --region "$REGION" \
    --output table
else
  aws amplify create-branch \
    --cli-input-json "file://$TMPDIR/amplify-input.json" \
    --region "$REGION" \
    --output table
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Done!"
echo "   Branch  : ${SANDBOX_BRANCH}"
echo "   App ID  : ${APP_ID}"
echo "   URL     : ${SANDBOX_URL}"
echo ""
echo "⚠️  ตรวจสอบใน Amplify Console ถ้าต้องการ:"
echo "   1. MONGO_URI — ถ้าต้องการ DB แยก"
echo "   2. STRIPE_* — ตรวจสอบว่าใช้ test keys"
echo ""
echo "   Console: https://ap-southeast-2.console.aws.amazon.com/amplify/apps/${APP_ID}/branches"

# ── Trigger build ──────────────────────────────────────────────────────────────

echo ""
echo "🚀 Triggering build..."
JOB_ID=$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$SANDBOX_BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query 'jobSummary.jobId' \
  --output text 2>/dev/null || echo "")

if [ -n "$JOB_ID" ]; then
  echo "   ✓ Build started — job ID: ${JOB_ID}"
else
  echo "   ⚠️  Trigger manually ใน Amplify Console"
fi

rm -rf "$TMPDIR"
