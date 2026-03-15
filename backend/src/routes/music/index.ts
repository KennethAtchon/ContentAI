import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  musicTracks,
  reelAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, ilike, or, gte, lte, desc, sql } from "drizzle-orm";
import { getFileUrl } from "../../services/storage/r2";
import { R2_PUBLIC_URL } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();

// GET /api/music/library
app.get(
  "/library",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const search = c.req.query("search");
      const mood = c.req.query("mood");
      const durationBucket = c.req.query("durationBucket");
      const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
      const limit = Math.min(50, parseInt(c.req.query("limit") ?? "20", 10));
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
          .select()
          .from(musicTracks)
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

      // Validate music track exists and is active
      const [track] = await db
        .select()
        .from(musicTracks)
        .where(
          and(eq(musicTracks.id, musicTrackId), eq(musicTracks.isActive, true)),
        );
      if (!track) {
        return c.json({ error: "Music track not found" }, 404);
      }

      // Delete existing music asset for this content if present
      const [existingMusic] = await db
        .select()
        .from(reelAssets)
        .where(
          and(
            eq(reelAssets.generatedContentId, generatedContentId),
            eq(reelAssets.userId, auth.user.id),
            eq(reelAssets.type, "music"),
          ),
        );
      if (existingMusic) {
        await db.delete(reelAssets).where(eq(reelAssets.id, existingMusic.id));
      }

      // Create new music asset reference
      const [asset] = await db
        .insert(reelAssets)
        .values({
          generatedContentId,
          userId: auth.user.id,
          type: "music",
          r2Key: track.r2Key,
          r2Url: null,
          durationMs: track.durationSeconds * 1000,
          metadata: {
            musicTrackId: track.id,
            trackName: track.name,
            artistName: track.artistName,
            mood: track.mood,
          },
        })
        .returning();

      // Denormalize the public background audio URL onto generated_content for fast publish reads
      const backgroundAudioPublicUrl = `${R2_PUBLIC_URL}/${track.r2Key}`;
      await db
        .update(generatedContent)
        .set({ backgroundAudioUrl: backgroundAudioPublicUrl })
        .where(eq(generatedContent.id, generatedContentId));

      return c.json({ asset });
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
