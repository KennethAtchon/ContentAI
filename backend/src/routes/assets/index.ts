import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  assets,
  contentAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, notInArray } from "drizzle-orm";
import {
  deleteFile,
  getFileUrl,
  getObjectWebStream,
  uploadFile,
} from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import {
  assetIdParamSchema,
  assetsListQuerySchema,
  patchAssetSchema,
} from "../../domain/assets/assets.schemas";

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
app.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", assetsListQuerySchema, validationErrorHook),
  async (c) => {
  try {
    const auth = c.get("auth");
    const { generatedContentId, type: typeFilter } = c.req.valid("query");

    // Verify content belongs to user
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

    const conditions = [
      eq(contentAssets.generatedContentId, generatedContentId),
    ];
    if (typeFilter) {
      conditions.push(eq(contentAssets.role, typeFilter));
    } else {
      // Editor / workspace source media only — not exported or legacy assembled outputs.
      conditions.push(
        notInArray(contentAssets.role, ["assembled_video", "final_video"]),
      );
      conditions.push(
        notInArray(assets.type, ["assembled_video", "final_video"]),
      );
    }

    const rows = await db
      .select({
        id: assets.id,
        userId: assets.userId,
        type: assets.type,
        source: assets.source,
        name: assets.name,
        mimeType: assets.mimeType,
        r2Key: assets.r2Key,
        r2Url: assets.r2Url,
        sizeBytes: assets.sizeBytes,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
        createdAt: assets.createdAt,
        role: contentAssets.role,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(and(...conditions));

    const assetsWithUrls = await Promise.all(
      rows.map(async (asset) => {
        if (asset.r2Key) {
          try {
            const signedUrl = await getFileUrl(asset.r2Key, 3600);
            const isAudio =
              asset.role === "voiceover" || asset.role === "background_music";
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

// GET /api/assets/:id/media-for-decode — same-origin binary stream for editor
// waveform decode (avoids browser CORS on signed R2 URLs).
app.get(
  "/:id/media-for-decode",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [row] = await db
        .select({
          r2Key: assets.r2Key,
          mimeType: assets.mimeType,
        })
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, auth.user.id)))
        .limit(1);

      if (!row?.r2Key) {
        return c.json({ error: "Asset not found" }, 404);
      }

      const { stream, contentType } = await getObjectWebStream(row.r2Key);
      return c.body(stream, 200, {
        "Content-Type":
          contentType ?? row.mimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=120",
      });
    } catch (error) {
      debugLog.error("Failed to stream asset for decode", {
        service: "assets-route",
        operation: "mediaForDecode",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to load media" }, 502);
    }
  },
);

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
      const generatedContentIdRaw = String(
        form.get("generatedContentId") ?? "",
      );
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
        return c.json({ error: "assetType must be video_clip or image" }, 400);
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
          {
            error: "Video exceeds 100MB limit",
            code: "PHASE4_UPLOAD_TOO_LARGE",
          },
          400,
        );
      }
      if (!isVideo && fileEntry.size > MAX_IMAGE_BYTES) {
        return c.json(
          {
            error: "Image exceeds 10MB limit",
            code: "PHASE4_UPLOAD_TOO_LARGE",
          },
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
        .insert(assets)
        .values({
          id: assetId,
          userId: auth.user.id,
          type: parsedType.data,
          source: "uploaded",
          name: fileEntry.name,
          mimeType: mime,
          r2Key,
          r2Url,
          sizeBytes: fileEntry.size,
          durationMs: null,
          metadata: {
            shotIndex,
            hasEmbeddedAudio: isVideo,
            useClipAudio: false,
            originalName: fileEntry.name,
          },
        })
        .returning();

      await db.insert(contentAssets).values({
        generatedContentId,
        assetId: asset.id,
        role: parsedType.data,
      });

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

// PATCH /api/assets/:id
app.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", assetIdParamSchema, validationErrorHook),
  zValidator("json", patchAssetSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");
      const { metadata } = c.req.valid("json");

      const [existing] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, auth.user.id)));

      if (!existing) {
        return c.json({ error: "Asset not found" }, 404);
      }

      const [updated] = await db
        .update(assets)
        .set({
          metadata: {
            ...((existing.metadata as Record<string, unknown>) ?? {}),
            ...metadata,
          },
        })
        .where(eq(assets.id, id))
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
  zValidator("param", assetIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [existing] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, auth.user.id)));

      if (!existing) {
        return c.json({ error: "Asset not found" }, 404);
      }

      // Delete R2 file only for voiceover (music is shared platform asset)
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

      // Delete contentAsset links first (restrict FK on assets)
      await db.delete(contentAssets).where(eq(contentAssets.assetId, id));

      await db.delete(assets).where(eq(assets.id, id));

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
