import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { assetsService } from "../../domain/singletons";
import { parseMediaLibraryUploadForm } from "../../domain/assets/media-library-upload";
import { uploadFile, deleteFile, getFileUrl } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { uuidParam } from "../../validation/shared.schemas";
import { Errors } from "../../utils/errors/app-error";

const app = new Hono<HonoEnv>();

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
    const {
      file: fileEntry,
      name,
      mediaType,
      mime,
    } = parseMediaLibraryUploadForm(form);

    const ext = fileEntry.name.includes(".")
      ? fileEntry.name.split(".").pop()!.toLowerCase()
      : mime.split("/")[1];

    const itemId = crypto.randomUUID();
    const r2Key = `media/library/${auth.user.id}/${itemId}.${ext}`;
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const r2Url = await uploadFile(fileBuffer, r2Key, mime);

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
  zValidator("param", uuidParam, zodValidationErrorHook),
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
