import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { assets } from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { uploadFile, deleteFile, getFileUrl } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();

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
  try {
    const auth = c.get("auth");

    const items = await db
      .select()
      .from(assets)
      .where(
        and(eq(assets.userId, auth.user.id), eq(assets.source, "uploaded")),
      )
      .orderBy(desc(assets.createdAt));

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
  } catch (error) {
    debugLog.error("Failed to fetch media items", {
      service: "media-route",
      operation: "getItems",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch media items" }, 500);
  }
});

// POST /api/media/upload — upload a new media item
app.post(
  "/upload",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const form = await c.req.formData();

      const fileEntry = form.get("file");
      const nameOverride = form.get("name");

      if (!(fileEntry instanceof File)) {
        return c.json({ error: "file is required" }, 400);
      }

      const mime = fileEntry.type.toLowerCase();
      const mediaType = getMediaType(mime);

      if (!mediaType) {
        return c.json(
          {
            error:
              "Unsupported file type. Allowed: mp4, mov, mp3, wav, jpeg, png, webp",
          },
          400,
        );
      }

      const maxBytes = getMaxBytes(mediaType);
      if (fileEntry.size > maxBytes) {
        const limitMb = maxBytes / (1024 * 1024);
        return c.json({ error: `File exceeds ${limitMb}MB limit` }, 400);
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

      const [item] = await db
        .insert(assets)
        .values({
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
        })
        .returning();

      const mediaUrl = await getFileUrl(r2Key, 3600).catch(() => r2Url);
      return c.json({ item: { ...item, mediaUrl } }, 201);
    } catch (error) {
      debugLog.error("Failed to upload media item", {
        service: "media-route",
        operation: "uploadItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to upload media item" }, 500);
    }
  },
);

const deleteParamSchema = z.object({ id: z.string().uuid() });

// DELETE /api/media/:id — delete a media item
app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const parsed = deleteParamSchema.safeParse({ id: c.req.param("id") });
      if (!parsed.success) {
        return c.json({ error: "Invalid id" }, 400);
      }
      const { id } = parsed.data;

      const [existing] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, id),
            eq(assets.userId, auth.user.id),
            eq(assets.source, "uploaded"),
          ),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "Media item not found" }, 404);
      }

      await deleteFile(existing.r2Key).catch((err) => {
        debugLog.error("Failed to delete R2 file", {
          service: "media-route",
          operation: "deleteItem",
          key: existing.r2Key,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

      await db.delete(assets).where(eq(assets.id, id));

      return c.body(null, 204);
    } catch (error) {
      debugLog.error("Failed to delete media item", {
        service: "media-route",
        operation: "deleteItem",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete media item" }, 500);
    }
  },
);

export default app;
