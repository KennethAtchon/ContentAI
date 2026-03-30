import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { uploadFile, deleteFile } from "../../services/storage/r2";
import { Errors } from "../../utils/errors/app-error";
import { adminService } from "../../domain/singletons";
import {
  adminMusicIdParamSchema,
  adminMusicQuerySchema,
  adminPatchMusicTrackBodySchema,
} from "../../domain/admin/admin.schemas";

const musicAdminRouter = new Hono<HonoEnv>();

// GET /api/admin/music — list all tracks (including inactive)
musicAdminRouter.get(
  "/music",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminMusicQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { search } = c.req.valid("query");
    const result = await adminService.listMusicTracks(search);
    return c.json(result);
  },
);

// POST /api/admin/music — upload new track (multipart/form-data)
musicAdminRouter.post(
  "/music",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    const auth = c.get("auth");
    const formData = await c.req.formData();

    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const artistName = formData.get("artistName") as string | null;
    const mood = formData.get("mood") as string | null;
    const genre = formData.get("genre") as string | null;

    if (!file || !name || !mood) {
      throw Errors.badRequest("file, name, and mood are required");
    }

    const VALID_MOODS = [
      "energetic",
      "calm",
      "dramatic",
      "funny",
      "inspiring",
    ];
    if (!VALID_MOODS.includes(mood)) {
      throw Errors.badRequest("Invalid mood value");
    }

    if (file.type !== "audio/mpeg" && !file.name.endsWith(".mp3")) {
      throw Errors.badRequest("Only MP3 files are accepted");
    }

    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE_BYTES) {
      throw Errors.badRequest("File exceeds 10MB limit");
    }

    const trackId = crypto.randomUUID();
    const r2Key = `music/tracks/${trackId}.mp3`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const r2Url = await uploadFile(buffer, r2Key, "audio/mpeg");

    // Estimate duration from file size (128kbps mp3 ≈ 16000 bytes/sec)
    const durationSeconds = Math.round(buffer.length / 16000);

    const { track } = await adminService.createPlatformMusicTrack({
      trackId,
      adminUserId: auth.user.id,
      name: name.trim(),
      artistName: artistName?.trim() || null,
      mood,
      genre: genre?.trim() || null,
      r2Key,
      r2Url,
      fileSize: file.size,
      durationSeconds,
    });

    return c.json({ track }, 201);
  },
);

// PATCH /api/admin/music/:id — toggle active or update metadata
musicAdminRouter.patch(
  "/music/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminMusicIdParamSchema, zodValidationErrorHook),
  zValidator(
    "json",
    adminPatchMusicTrackBodySchema,
    zodValidationErrorHook,
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");

    const result = await adminService.updateMusicTrack(id, updates);
    return c.json(result);
  },
);

// DELETE /api/admin/music/:id — delete track + R2 file
musicAdminRouter.delete(
  "/music/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminMusicIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");

    const existing = await adminService.prepareDeletePlatformMusicTrack(id);

    if (existing.r2Key) {
      await deleteFile(existing.r2Key).catch(() => {
        // Best-effort R2 deletion
      });
    }

    await adminService.finalizeDeletePlatformMusicTrack(
      existing.trackId,
      existing.assetId,
    );

    return c.body(null, 204);
  },
);

export default musicAdminRouter;
