import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  generatedContent,
  reelAssets,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { deleteFile, getFileUrl, uploadFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const uploadAssetTypeSchema = z.enum(["video_clip", "image"]);

function isAllowedVideoMime(mime: string): boolean {
  return mime === "video/mp4" || mime === "video/quicktime";
}

function isAllowedImageMime(mime: string): boolean {
  return (
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/png" ||
    mime === "image/webp"
  );
}

// GET /api/assets?generatedContentId=X&type=voiceover
app.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const generatedContentIdParam = c.req.query("generatedContentId");
    const typeFilter = c.req.query("type");

    if (!generatedContentIdParam) {
      return c.json({ error: "generatedContentId is required" }, 400);
    }

    const generatedContentId = parseInt(generatedContentIdParam, 10);
    if (isNaN(generatedContentId)) {
      return c.json({ error: "Invalid generatedContentId" }, 400);
    }

    const conditions = [
      eq(reelAssets.generatedContentId, generatedContentId),
      eq(reelAssets.userId, auth.user.id),
    ];
    if (typeFilter) {
      conditions.push(eq(reelAssets.type, typeFilter));
    }

    const assets = await db
      .select()
      .from(reelAssets)
      .where(and(...conditions));

    // Generate fresh signed URLs for media assets.
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        if (asset.r2Key) {
          try {
            const signedUrl = await getFileUrl(asset.r2Key, 3600);
            const isAudio = asset.type === "voiceover" || asset.type === "music";
            return {
              ...asset,
              audioUrl: isAudio ? signedUrl : null,
              mediaUrl: signedUrl,
            };
          } catch {
            return { ...asset, audioUrl: null, mediaUrl: null };
          }
        }
        return { ...asset, audioUrl: null, mediaUrl: null };
      }),
    );

    return c.json({ assets: assetsWithUrls });
  } catch (error) {
    debugLog.error("Failed to fetch assets", {
      service: "assets-route",
      operation: "getAssets",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch assets" }, 500);
  }
});

// POST /api/assets/upload
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
      const generatedContentIdRaw = String(form.get("generatedContentId") ?? "");
      const assetTypeRaw = String(form.get("assetType") ?? "");
      const shotIndexRaw = String(form.get("shotIndex") ?? "");

      if (!(fileEntry instanceof File)) {
        return c.json({ error: "file is required" }, 400);
      }

      const generatedContentId = Number(generatedContentIdRaw);
      if (!generatedContentId || Number.isNaN(generatedContentId)) {
        return c.json({ error: "Invalid generatedContentId" }, 400);
      }

      const parsedType = uploadAssetTypeSchema.safeParse(assetTypeRaw);
      if (!parsedType.success) {
        return c.json(
          { error: "assetType must be video_clip or image" },
          400,
        );
      }

      const shotIndex =
        shotIndexRaw.length > 0 && !Number.isNaN(Number(shotIndexRaw))
          ? Number(shotIndexRaw)
          : null;

      const [content] = await db
        .select({ id: generatedContent.id })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, generatedContentId),
            eq(generatedContent.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const mime = fileEntry.type.toLowerCase();
      const isVideo = parsedType.data === "video_clip";
      const allowed =
        (isVideo && isAllowedVideoMime(mime)) ||
        (!isVideo && isAllowedImageMime(mime));
      if (!allowed) {
        return c.json({ error: "Unsupported file type" }, 400);
      }

      if (isVideo && fileEntry.size > MAX_VIDEO_BYTES) {
        return c.json(
          { error: "Video exceeds 100MB limit", code: "PHASE4_UPLOAD_TOO_LARGE" },
          400,
        );
      }
      if (!isVideo && fileEntry.size > MAX_IMAGE_BYTES) {
        return c.json(
          { error: "Image exceeds 10MB limit", code: "PHASE4_UPLOAD_TOO_LARGE" },
          400,
        );
      }

      const ext = fileEntry.name.includes(".")
        ? fileEntry.name.split(".").pop()!.toLowerCase()
        : isVideo
          ? "mp4"
          : "jpg";

      const assetId = crypto.randomUUID();
      const r2Key = `media/uploads/${auth.user.id}/${assetId}.${ext}`;
      const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
      const r2Url = await uploadFile(fileBuffer, r2Key, mime);

      const [asset] = await db
        .insert(reelAssets)
        .values({
          id: assetId,
          generatedContentId,
          userId: auth.user.id,
          type: parsedType.data,
          r2Key,
          r2Url,
          durationMs: null,
          metadata: {
            sourceType: "user_uploaded",
            shotIndex,
            hasEmbeddedAudio: isVideo,
            useClipAudio: false,
            originalName: fileEntry.name,
            mimeType: mime,
            sizeBytes: fileEntry.size,
          },
        })
        .returning();

      const mediaUrl = await getFileUrl(r2Key, 3600).catch(() => r2Url);
      return c.json({ asset: { ...asset, mediaUrl } }, 201);
    } catch (error) {
      debugLog.error("Failed to upload asset", {
        service: "assets-route",
        operation: "uploadAsset",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to upload asset" }, 500);
    }
  },
);

const patchAssetSchema = z.object({
  metadata: z.record(z.string(), z.unknown()),
});

// PATCH /api/assets/:id
app.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => null);
      const parsed = patchAssetSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }
      const { metadata } = parsed.data;

      const [existing] = await db
        .select()
        .from(reelAssets)
        .where(and(eq(reelAssets.id, id), eq(reelAssets.userId, auth.user.id)));

      if (!existing) {
        return c.json({ error: "Asset not found" }, 404);
      }

      const [updated] = await db
        .update(reelAssets)
        .set({
          metadata: {
            ...((existing.metadata as Record<string, unknown>) ?? {}),
            ...metadata,
          },
        })
        .where(eq(reelAssets.id, id))
        .returning();

      return c.json({ asset: updated });
    } catch (error) {
      debugLog.error("Failed to update asset", {
        service: "assets-route",
        operation: "updateAsset",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update asset" }, 500);
    }
  },
);

// DELETE /api/assets/:id
app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

      const [existing] = await db
        .select()
        .from(reelAssets)
        .where(and(eq(reelAssets.id, id), eq(reelAssets.userId, auth.user.id)));

      if (!existing) {
        return c.json({ error: "Asset not found" }, 404);
      }

      // Delete R2 file only for voiceover (music is shared)
      if (existing.type === "voiceover" && existing.r2Key) {
        await deleteFile(existing.r2Key).catch((err) => {
          debugLog.error("Failed to delete R2 file", {
            service: "assets-route",
            operation: "deleteAsset",
            key: existing.r2Key,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        });
      }

      await db.delete(reelAssets).where(eq(reelAssets.id, id));

      return c.body(null, 204);
    } catch (error) {
      debugLog.error("Failed to delete asset", {
        service: "assets-route",
        operation: "deleteAsset",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete asset" }, 500);
    }
  },
);

export default app;
