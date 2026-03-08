import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  APP_ENV,
} from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug/debug";

if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  debugLog.warn(
    "R2 configuration is incomplete. R2 functionality will be disabled",
    { service: "r2-storage" },
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

export async function uploadFile(
  file: File | Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // Add /testing prefix in development mode
  const finalKey = APP_ENV === "development" ? `testing/${key}` : key;

  const params = {
    Bucket: R2_BUCKET_NAME,
    Key: finalKey,
    Body: file instanceof File ? file.stream() : file,
    ContentType: contentType,
  };

  const upload = new Upload({
    client: s3Client,
    params,
  });

  try {
    await upload.done();
    return `${R2_PUBLIC_URL || ""}/${finalKey}`.replace(/([^:]\/)\/+/g, "$1"); // Remove duplicate slashes
  } catch (error) {
    debugLog.error(
      "Error uploading to R2",
      { service: "r2-storage", key: finalKey },
      error,
    );
    throw new Error("Failed to upload file to R2 storage");
  }
}

export async function deleteFile(key: string): Promise<void> {
  // Add /testing prefix in development mode
  const finalKey = APP_ENV === "development" ? `testing/${key}` : key;

  const params = {
    Bucket: R2_BUCKET_NAME,
    Key: finalKey,
  };

  try {
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (error) {
    debugLog.error(
      "Error deleting from R2",
      { service: "r2-storage", key: finalKey },
      error,
    );
    throw new Error("Failed to delete file from R2 storage");
  }
}

export async function getFileUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  // Add /testing prefix in development mode
  const finalKey = APP_ENV === "development" ? `testing/${key}` : key;

  const params = {
    Bucket: R2_BUCKET_NAME,
    Key: finalKey,
  };

  try {
    return await getSignedUrl(s3Client, new GetObjectCommand(params), {
      expiresIn,
    });
  } catch (error) {
    debugLog.error(
      "Error generating signed URL",
      { service: "r2-storage", key: finalKey },
      error,
    );
    throw new Error("Failed to generate signed URL");
  }
}

export function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    // Remove leading slash if present and decode URL components
    let key = parsedUrl.pathname.startsWith("/")
      ? decodeURIComponent(parsedUrl.pathname.substring(1))
      : decodeURIComponent(parsedUrl.pathname);

    // Remove /testing prefix in development mode to get the original key
    if (APP_ENV === "development" && key.startsWith("testing/")) {
      key = key.substring(8); // Remove 'testing/' prefix
    }

    return key;
  } catch (e) {
    debugLog.error("Error parsing URL", { service: "r2-storage", url }, e);
    return null;
  }
}
