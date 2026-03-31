import { z } from "zod";
import { Errors } from "../../utils/errors/app-error";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const uploadAssetTypeSchema = z.enum(["video_clip", "image"]);

export function isAllowedVideoMime(mime: string): boolean {
  return mime === "video/mp4" || mime === "video/quicktime";
}

export function isAllowedImageMime(mime: string): boolean {
  return (
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/png" ||
    mime === "image/webp"
  );
}

export type ParsedUserAssetUpload = {
  file: File;
  generatedContentId: number;
  assetType: z.infer<typeof uploadAssetTypeSchema>;
  shotIndex: number | null;
};

/** Parse multipart fields for POST /api/assets/upload; throws `Errors.badRequest`. */
export function parseUserAssetUploadForm(
  form: globalThis.FormData,
): ParsedUserAssetUpload {
  const fileEntry = form.get("file");
  const generatedContentIdRaw = String(form.get("generatedContentId") ?? "");
  const assetTypeRaw = String(form.get("assetType") ?? "");
  const shotIndexRaw = String(form.get("shotIndex") ?? "");

  if (!(fileEntry instanceof File)) {
    throw Errors.badRequest("file is required");
  }

  const generatedContentId = Number(generatedContentIdRaw);
  if (!generatedContentId || Number.isNaN(generatedContentId)) {
    throw Errors.badRequest("Invalid generatedContentId");
  }

  const parsedType = uploadAssetTypeSchema.safeParse(assetTypeRaw);
  if (!parsedType.success) {
    throw Errors.badRequest("assetType must be video_clip or image");
  }

  const shotIndex =
    shotIndexRaw.length > 0 && !Number.isNaN(Number(shotIndexRaw))
      ? Number(shotIndexRaw)
      : null;

  const mime = fileEntry.type.toLowerCase();
  const isVideo = parsedType.data === "video_clip";
  const allowed =
    (isVideo && isAllowedVideoMime(mime)) ||
    (!isVideo && isAllowedImageMime(mime));
  if (!allowed) {
    throw Errors.badRequest("Unsupported file type");
  }

  if (isVideo && fileEntry.size > MAX_VIDEO_BYTES) {
    throw Errors.badRequest(
      "Video exceeds 100MB limit",
      "PHASE4_UPLOAD_TOO_LARGE",
    );
  }
  if (!isVideo && fileEntry.size > MAX_IMAGE_BYTES) {
    throw Errors.badRequest(
      "Image exceeds 10MB limit",
      "PHASE4_UPLOAD_TOO_LARGE",
    );
  }

  return {
    file: fileEntry,
    generatedContentId,
    assetType: parsedType.data,
    shotIndex,
  };
}
