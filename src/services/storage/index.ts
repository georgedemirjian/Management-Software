import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, isR2Configured } from "@/lib/env";

export { isR2Configured };

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Lazily-constructed R2 client, kept out of module scope so the app boots
 * without R2 configured — call sites check `isR2Configured()` first. R2 is
 * S3-compatible, so the plain AWS SDK works against its endpoint.
 */
let cached: S3Client | undefined;

function getClient(): S3Client {
  if (!isR2Configured()) {
    throw new Error(
      "R2 is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME unset). Guard with isR2Configured().",
    );
  }
  cached ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cached;
}

/** Presigned PUT URL the browser uploads directly to — bytes never touch the Next.js server. */
export async function createPresignedUploadUrl(
  storageKey: string,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/**
 * Short-lived presigned GET URL, minted only after the caller re-verifies
 * ownership. `downloadName` sets Content-Disposition so the browser saves
 * the file under its original name instead of the storage key.
 */
export async function createPresignedDownloadUrl(
  storageKey: string,
  downloadName: string,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** Hard delete of the underlying object. Documents themselves soft-delete; this is not called from that path. */
export async function deleteObject(storageKey: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: storageKey }),
  );
}
