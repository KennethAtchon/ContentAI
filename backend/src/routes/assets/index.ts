import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { reelAssets } from "../../infrastructure/database/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { deleteFile, getFileUrl } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();

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

    // Generate fresh signed URLs for audio assets (voiceover + music)
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        if (
          (asset.type === "voiceover" || asset.type === "music") &&
          asset.r2Key
        ) {
          try {
            const audioUrl = await getFileUrl(asset.r2Key, 3600);
            return { ...asset, audioUrl };
          } catch {
            return { ...asset, audioUrl: null };
          }
        }
        return { ...asset, audioUrl: null };
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
