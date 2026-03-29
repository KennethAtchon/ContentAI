import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { assetsService } from "../../domain/singletons";
import { uploadFile, deleteFile, getFileUrl } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { uuidParam } from "../../validation/shared.schemas";
import { AppError, Errors } from "../../utils/errors/app-error";

const app = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_VIDEO_MIMES = new Set(["video/mp4", "video/quicktime"]);
const ALLOWED_AUDIO_MIMES = new Set(["audio/mpeg", "audio/wav", "audio/mp4"]);
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getMediaType(mime: string): "video" | "audio" | "image" | null {
  if (ALLOWED_VIDEO_MIMES.has(mime)) return "video";
  if (ALLOWED_AUDIO_MIMES.has(mime)) return "audio";
  if (ALLOWED_IMAGE_MIMES.has(mime)) return "image";
  return null;
}

function getMaxBytes(mediaType: "video" | "audio" | "image"): number {
  if (mediaType === "video") return MAX_VIDEO_BYTES;
  if (mediaType === "audio") return MAX_AUDIO_BYTES;
  return MAX_IMAGE_BYTES;
}

// GET /api/media — list user-uploaded assets
app.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  const auth = c.get("auth");

  const items = await assetsService.listUserLibrary(auth.user.id);

  const itemsWithUrls = await Promise.all(
    items.map(async (item) => {
      try {
        const mediaUrl = await getFileUrl(item.r2Key, 3600);
        return { ...item, mediaUrl };
      } catch {
        return { ...item, mediaUrl: null };
      }
    }),
  );

  return c.json({ items: itemsWithUrls });
});

// POST /api/media/upload — upload a new media item
app.post(
  "/upload",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const form = await c.req.formData();

    const fileEntry = form.get("file");
    const nameOverride = form.get("name");

    if (!(fileEntry instanceof File)) {
      throw new AppError("file is required", "INVALID_INPUT", 400);
    }

      const mime = fileEntry.type.toLowerCase();
      const mediaType = getMediaType(mime);

    if (!mediaType) {
      throw new AppError(
        "Unsupported file type. Allowed: mp4, mov, mp3, wav, jpeg, png, webp",
        "INVALID_INPUT",
        400,
      );
    }

      const maxBytes = getMaxBytes(mediaType);
    if (fileEntry.size > maxBytes) {
      const limitMb = maxBytes / (1024 * 1024);
      throw new AppError(`File exceeds ${limitMb}MB limit`, "INVALID_INPUT", 400);
    }

      const ext = fileEntry.name.includes(".")
        ? fileEntry.name.split(".").pop()!.toLowerCase()
        : mime.split("/")[1];

      const itemId = crypto.randomUUID();
      const r2Key = `media/library/${auth.user.id}/${itemId}.${ext}`;
      const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
      const r2Url = await uploadFile(fileBuffer, r2Key, mime);

    const name =
      nameOverride instanceof File
        ? fileEntry.name
        : ((nameOverride as string | null) ?? fileEntry.name);

    const item = await assetsService.createUploadedAsset({
      id: itemId,
      userId: auth.user.id,
      type: mediaType,
      source: "uploaded",
      name,
      mimeType: mime,
      r2Key,
      r2Url,
      sizeBytes: fileEntry.size,
      durationMs: null,
      metadata: {},
    });

    const mediaUrl = await getFileUrl(r2Key, 3600).catch(() => r2Url);
    return c.json({ item: { ...item, mediaUrl } }, 201);
  },
);

// DELETE /api/media/:id — delete a media item
app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const existing = await assetsService.getUploadedAsset(auth.user.id, id);

    if (!existing) {
      throw Errors.notFound("Media item");
    }

    await deleteFile(existing.r2Key).catch((err) => {
      debugLog.error("Failed to delete R2 file", {
        service: "media-route",
        operation: "deleteItem",
        key: existing.r2Key,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });

    await assetsService.removeById(id);

    return c.body(null, 204);
  },
);

export default app;
