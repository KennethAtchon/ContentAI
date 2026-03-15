import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { musicTracks } from "../../infrastructure/database/drizzle/schema";
import { eq, desc, ilike, or } from "drizzle-orm";
import { uploadFile, deleteFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";

const musicAdminRouter = new Hono<HonoEnv>();

// GET /api/admin/music — list all tracks (including inactive)
musicAdminRouter.get(
  "/music",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const search = c.req.query("search")?.trim();

      const conditions = search
        ? [
            or(
              ilike(musicTracks.name, `%${search}%`),
              ilike(musicTracks.artistName, `%${search}%`),
            ),
          ]
        : [];

      const tracks = await db
        .select()
        .from(musicTracks)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(musicTracks.createdAt));

      return c.json({ tracks });
    } catch (error) {
      debugLog.error("Admin: failed to list music tracks", {
        service: "admin-music",
        operation: "listTracks",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list music tracks" }, 500);
    }
  },
);

// POST /api/admin/music — upload new track (multipart/form-data)
musicAdminRouter.post(
  "/music",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const formData = await c.req.formData();

      const file = formData.get("file") as File | null;
      const name = formData.get("name") as string | null;
      const artistName = formData.get("artistName") as string | null;
      const mood = formData.get("mood") as string | null;
      const genre = formData.get("genre") as string | null;

      if (!file || !name || !mood) {
        return c.json({ error: "file, name, and mood are required" }, 400);
      }

      const VALID_MOODS = [
        "energetic",
        "calm",
        "dramatic",
        "funny",
        "inspiring",
      ];
      if (!VALID_MOODS.includes(mood)) {
        return c.json({ error: "Invalid mood value" }, 400);
      }

      if (file.type !== "audio/mpeg" && !file.name.endsWith(".mp3")) {
        return c.json({ error: "Only MP3 files are accepted" }, 400);
      }

      const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_SIZE_BYTES) {
        return c.json({ error: "File exceeds 10MB limit" }, 400);
      }

      const trackId = crypto.randomUUID();
      const r2Key = `music/tracks/${trackId}.mp3`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadFile(buffer, r2Key, "audio/mpeg");

      // Estimate duration from file size (128kbps mp3 ≈ 16000 bytes/sec)
      const durationSeconds = Math.round(buffer.length / 16000);

      const [track] = await db
        .insert(musicTracks)
        .values({
          id: trackId,
          name: name.trim(),
          artistName: artistName?.trim() || null,
          durationSeconds,
          mood,
          genre: genre?.trim() || null,
          r2Key,
          isActive: true,
          uploadedBy: auth.user.id,
        })
        .returning();

      return c.json({ track }, 201);
    } catch (error) {
      debugLog.error("Admin: failed to upload music track", {
        service: "admin-music",
        operation: "uploadTrack",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to upload music track" }, 500);
    }
  },
);

// PATCH /api/admin/music/:id — toggle active or update metadata
musicAdminRouter.patch(
  "/music/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator(
    "json",
    z.object({
      isActive: z.boolean().optional(),
      name: z.string().min(1).optional(),
      artistName: z.string().nullable().optional(),
      mood: z
        .enum(["energetic", "calm", "dramatic", "funny", "inspiring"])
        .optional(),
      genre: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    try {
      const { id } = c.req.param();
      const updates = c.req.valid("json");

      const [existing] = await db
        .select()
        .from(musicTracks)
        .where(eq(musicTracks.id, id));

      if (!existing) {
        return c.json({ error: "Track not found" }, 404);
      }

      const [updated] = await db
        .update(musicTracks)
        .set(updates)
        .where(eq(musicTracks.id, id))
        .returning();

      return c.json({ track: updated });
    } catch (error) {
      debugLog.error("Admin: failed to update music track", {
        service: "admin-music",
        operation: "updateTrack",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update music track" }, 500);
    }
  },
);

// DELETE /api/admin/music/:id — delete track + R2 file
musicAdminRouter.delete(
  "/music/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const { id } = c.req.param();

      const [existing] = await db
        .select()
        .from(musicTracks)
        .where(eq(musicTracks.id, id));

      if (!existing) {
        return c.json({ error: "Track not found" }, 404);
      }

      await deleteFile(existing.r2Key).catch((err) => {
        debugLog.error("Admin: failed to delete R2 file for music track", {
          service: "admin-music",
          operation: "deleteTrack",
          key: existing.r2Key,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

      await db.delete(musicTracks).where(eq(musicTracks.id, id));

      return c.body(null, 204);
    } catch (error) {
      debugLog.error("Admin: failed to delete music track", {
        service: "admin-music",
        operation: "deleteTrack",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete music track" }, 500);
    }
  },
);

export default musicAdminRouter;
