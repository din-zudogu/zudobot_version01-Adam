import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import { generateExternalId, mintAwsRoleStateToken } from "@/lib/integration/awsRoleState";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = "/cloudformation/zudobot-codecommit-access.yaml";
const DEFAULT_CONSOLE_REGION = "ap-southeast-1";
const STACK_NAME = "ZudobotCodeCommitAccess";

/**
 * Builds the AWS CloudFormation "Quick create stack" deep link, pre-filled
 * with Zudobot's own AWS account ID and a freshly generated per-connection
 * ExternalId — the customer just reviews and clicks "Create stack" in their
 * own AWS Console, never typing anything themselves. See
 * apps/web/public/cloudformation/zudobot-codecommit-access.yaml for what the
 * stack actually creates (a scoped cross-account IAM Role, no static keys).
 */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let zudobotAccountId: string;
  try {
    zudobotAccountId = AMPLIFY_CONFIG.zudobotAwsAccountId;
  } catch {
    return NextResponse.json({ error: "integration_not_configured" }, { status: 503 });
  }

  const externalId = generateExternalId();
  const externalIdToken = mintAwsRoleStateToken(token.sub as string, externalId);

  const templateUrl = `${requirePublicAppUrl()}${TEMPLATE_PATH}`;
  const quickCreateParams = [
    `templateURL=${encodeURIComponent(templateUrl)}`,
    `stackName=${encodeURIComponent(STACK_NAME)}`,
    `param_ZudobotAccountId=${encodeURIComponent(zudobotAccountId)}`,
    `param_ExternalId=${encodeURIComponent(externalId)}`,
  ].join("&");

  const launchUrl =
    `https://console.aws.amazon.com/cloudformation/home?region=${DEFAULT_CONSOLE_REGION}` +
    `#/stacks/quickcreate?${quickCreateParams}`;

  return NextResponse.json({ launchUrl, externalIdToken }, { status: 200 });
}
