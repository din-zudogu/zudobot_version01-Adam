/**
 * Private S3 storage for payment-slip images (proof of payment from a
 * tenant's own customers). Separate from the public widget-CDN bucket
 * (WIDGET_S3_BUCKET, CI-only, static widget.js only) — this bucket must stay
 * fully private since slip images are financial documents; access is always
 * via a short-lived signed URL, never a public object URL.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

function getClient(): S3Client {
  return new S3Client({
    region: AMPLIFY_CONFIG.awsRegion,
    credentials: {
      accessKeyId: AMPLIFY_CONFIG.awsAccessKeyId,
      secretAccessKey: AMPLIFY_CONFIG.awsSecretAccessKey,
    },
  });
}

export async function uploadSlipImage(
  tenantId: string,
  transId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
  const key = `payment-slips/${tenantId}/${transId}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: AMPLIFY_CONFIG.paymentSlipsS3Bucket,
      Key: key,
      Body: Buffer.from(base64, "base64"),
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    })
  );

  return key;
}

export async function getSlipImageSignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: AMPLIFY_CONFIG.paymentSlipsS3Bucket,
    Key: s3Key,
  });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}
