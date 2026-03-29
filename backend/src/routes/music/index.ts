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
  musicTracks,
  assets,
  contentAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, ilike, or, gte, lte, desc, sql } from "drizzle-orm";
import { getFileUrl } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { musicListQuerySchema } from "../../domain/music/music.schemas";

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

// GET /api/music/library
app.get(
  "/library",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", musicListQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { search, mood, durationBucket, page, limit } =
        c.req.valid("query");
      const offset = (page - 1) * limit;

      const conditions = [eq(musicTracks.isActive, true)];

      if (search) {
        conditions.push(
          or(
            ilike(musicTracks.name, `%${search}%`),
            ilike(musicTracks.artistName, `%${search}%`),
          )!,
        );
      }

      if (mood) {
        conditions.push(eq(musicTracks.mood, mood));
      }

      if (durationBucket) {
        if (durationBucket === "15") {
          conditions.push(lte(musicTracks.durationSeconds, 20));
        } else if (durationBucket === "30") {
          conditions.push(
            and(
              gte(musicTracks.durationSeconds, 21),
              lte(musicTracks.durationSeconds, 45),
            )!,
          );
        } else if (durationBucket === "60") {
          conditions.push(
            and(
              gte(musicTracks.durationSeconds, 46),
              lte(musicTracks.durationSeconds, 90),
            )!,
          );
        }
      }

      const [tracks, [countRow]] = await Promise.all([
        db
          .select({
            id: musicTracks.id,
            name: musicTracks.name,
            artistName: musicTracks.artistName,
            durationSeconds: musicTracks.durationSeconds,
            mood: musicTracks.mood,
            genre: musicTracks.genre,
            createdAt: musicTracks.createdAt,
            r2Key: assets.r2Key,
          })
          .from(musicTracks)
          .innerJoin(assets, eq(musicTracks.assetId, assets.id))
          .where(and(...conditions))
          .orderBy(desc(musicTracks.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(musicTracks)
          .where(and(...conditions)),
      ]);

      const total = countRow?.count ?? 0;

      const tracksWithUrls = await Promise.all(
        tracks.map(async (track) => {
          let previewUrl = "";
          try {
            previewUrl = await getFileUrl(track.r2Key, 3600);
          } catch {
            // Fail silently — track row still returned
          }
          return {
            id: track.id,
            name: track.name,
            artistName: track.artistName,
            durationSeconds: track.durationSeconds,
            mood: track.mood,
            genre: track.genre,
            previewUrl,
            isSystemTrack: true,
          };
        }),
      );

      return c.json({
        tracks: tracksWithUrls,
        total,
        page,
        hasMore: offset + tracks.length < total,
      });
    } catch (error) {
      debugLog.error("Failed to fetch music library", {
        service: "music-route",
        operation: "getLibrary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch music library" }, 500);
    }
  },
);

// POST /api/music/attach
app.post(
  "/attach",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator(
    "json",
    z.object({
      generatedContentId: z.number().int().positive(),
      musicTrackId: z.string(),
    }),
  ),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { generatedContentId, musicTrackId } = c.req.valid("json");

      // Validate content belongs to user
      const [content] = await db
        .select({ id: generatedContent.id })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, generatedContentId),
            eq(generatedContent.userId, auth.user.id),
          ),
        );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      // Validate music track exists and is active (join to get assetId + r2Key)
      const [track] = await db
        .select({
          id: musicTracks.id,
          name: musicTracks.name,
          artistName: musicTracks.artistName,
          mood: musicTracks.mood,
          assetId: musicTracks.assetId,
          r2Key: assets.r2Key,
          durationSeconds: musicTracks.durationSeconds,
        })
        .from(musicTracks)
        .innerJoin(assets, eq(musicTracks.assetId, assets.id))
        .where(
          and(eq(musicTracks.id, musicTrackId), eq(musicTracks.isActive, true)),
        )
        .limit(1);
      if (!track) {
        return c.json({ error: "Music track not found" }, 404);
      }

      // Replace existing background_music content asset if present
      await db
        .delete(contentAssets)
        .where(
          and(
            eq(contentAssets.generatedContentId, generatedContentId),
            eq(contentAssets.role, "background_music"),
          ),
        );

      // Link the platform asset to this content
      await db.insert(contentAssets).values({
        generatedContentId,
        assetId: track.assetId,
        role: "background_music",
      });

      const { refreshEditorTimeline } = await import(
        "../editor/services/refresh-editor-timeline"
      );
      await refreshEditorTimeline(generatedContentId, auth.user.id).catch(
        (err) =>
          debugLog.warn("refreshEditorTimeline (attach-music) failed", {
            err,
            contentId: generatedContentId,
          }),
      );

      return c.json({
        asset: {
          assetId: track.assetId,
          role: "background_music",
          trackName: track.name,
          artistName: track.artistName,
          mood: track.mood,
          durationMs: track.durationSeconds * 1000,
        },
      });
    } catch (error) {
      debugLog.error("Failed to attach music", {
        service: "music-route",
        operation: "attachMusic",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to attach music" }, 500);
    }
  },
);

export default app;
