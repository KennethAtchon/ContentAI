import { Errors } from "../../utils/errors/app-error";

export const MEDIA_LIBRARY_MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MEDIA_LIBRARY_MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MEDIA_LIBRARY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime"]);
const AUDIO_MIMES = new Set(["audio/mpeg", "audio/wav", "audio/mp4"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getMediaLibraryType(
  mime: string,
): "video" | "audio" | "image" | null {
  const m = mime.toLowerCase();
  if (VIDEO_MIMES.has(m)) return "video";
  if (AUDIO_MIMES.has(m)) return "audio";
  if (IMAGE_MIMES.has(m)) return "image";
  return null;
}

export function getMediaLibraryMaxBytes(
  mediaType: "video" | "audio" | "image",
): number {
  if (mediaType === "video") return MEDIA_LIBRARY_MAX_VIDEO_BYTES;
  if (mediaType === "audio") return MEDIA_LIBRARY_MAX_AUDIO_BYTES;
  return MEDIA_LIBRARY_MAX_IMAGE_BYTES;
}

export type ParsedMediaLibraryUpload = {
  file: File;
  name: string;
  mediaType: "video" | "audio" | "image";
  mime: string;
};

/** Parse multipart for POST /api/media/upload; throws `AppError` with `INVALID_INPUT`. */
export function parseMediaLibraryUploadForm(
  form: globalThis.FormData,
): ParsedMediaLibraryUpload {
  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    throw Errors.badRequest("file is required", "INVALID_INPUT");
  }

  const mime = fileEntry.type.toLowerCase();
  const mediaType = getMediaLibraryType(mime);
  if (!mediaType) {
    throw Errors.badRequest(
      "Unsupported file type. Allowed: mp4, mov, mp3, wav, jpeg, png, webp",
      "INVALID_INPUT",
    );
  }

  const maxBytes = getMediaLibraryMaxBytes(mediaType);
  if (fileEntry.size > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024);
    throw Errors.badRequest(
      `File exceeds ${limitMb}MB limit`,
      "INVALID_INPUT",
    );
  }

  const nameRaw = form.get("name");
  const name =
    typeof nameRaw === "string" && nameRaw.trim().length > 0
      ? nameRaw.trim()
      : fileEntry.name;

  return { file: fileEntry, name, mediaType, mime };
}
