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
  editProjects,
  exportJobs,
  reelAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync, writeFileSync } from "fs";

const app = new Hono<HonoEnv>();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const clipDataSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable().optional(),
  r2Key: z.string().optional(),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(0).optional(),
  speed: z.number().min(0.1).max(10).optional(),
  volume: z.number().min(0).max(2).optional(),
  muted: z.boolean().optional(),
  textContent: z.string().max(2000).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  scale: z.number().optional(),
});

const trackDataSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(["video", "audio", "music", "text"]),
  muted: z.boolean(),
  locked: z.boolean().optional(),
  name: z.string().optional(),
  clips: z.array(clipDataSchema),
});

const patchProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  tracks: z.array(trackDataSchema).optional(),
  durationMs: z.number().int().min(0).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  resolution: z.enum(["720p", "1080p", "4k"]).optional(),
});

const createProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  generatedContentId: z.number().int().optional(),
});

const exportSchema = z.object({
  resolution: z.enum(["720p", "1080p", "4k"]).optional(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
});

// ─── GET /api/editor ─────────────────────────────────────────────────────────

app.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");

    const projects = await db
      .select()
      .from(editProjects)
      .where(eq(editProjects.userId, auth.user.id))
      .orderBy(desc(editProjects.updatedAt));

    return c.json({ projects });
  } catch (error) {
    debugLog.error("Failed to list edit projects", {
      service: "editor-route",
      operation: "listProjects",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to list edit projects" }, 500);
  }
});

// ─── POST /api/editor ────────────────────────────────────────────────────────

app.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json().catch(() => ({}));
      const parsed = createProjectSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      // If a generatedContentId is provided, verify the user owns it.
      if (parsed.data.generatedContentId) {
        const [ownedContent] = await db
          .select({ id: generatedContent.id })
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, parsed.data.generatedContentId),
              eq(generatedContent.userId, auth.user.id),
            ),
          )
          .limit(1);

        if (!ownedContent) {
          return c.json({ error: "Content not found" }, 403);
        }
      }

      const [project] = await db
        .insert(editProjects)
        .values({
          userId: auth.user.id,
          title: parsed.data.title ?? "Untitled Edit",
          generatedContentId: parsed.data.generatedContentId ?? null,
          tracks: [],
          durationMs: 0,
          fps: 30,
          resolution: "1080p",
        })
        .returning();

      return c.json({ project }, 201);
    } catch (error) {
      debugLog.error("Failed to create edit project", {
        service: "editor-route",
        operation: "createProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create edit project" }, 500);
    }
  },
);

// ─── GET /api/editor/:id ─────────────────────────────────────────────────────

app.get("/:id", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const { id } = c.req.param();

    const [project] = await db
      .select()
      .from(editProjects)
      .where(
        and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
      )
      .limit(1);

    if (!project) {
      return c.json({ error: "Edit project not found" }, 404);
    }

    return c.json({ project });
  } catch (error) {
    debugLog.error("Failed to fetch edit project", {
      service: "editor-route",
      operation: "getProject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch edit project" }, 500);
  }
});

// ─── PATCH /api/editor/:id (auto-save) ───────────────────────────────────────

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
      const parsed = patchProjectSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const [existing] = await db
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      const updateData: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.tracks !== undefined)
        updateData.tracks = parsed.data.tracks;
      if (parsed.data.durationMs !== undefined)
        updateData.durationMs = parsed.data.durationMs;
      if (parsed.data.fps !== undefined) updateData.fps = parsed.data.fps;
      if (parsed.data.resolution !== undefined)
        updateData.resolution = parsed.data.resolution;

      const [updated] = await db
        .update(editProjects)
        .set(updateData)
        .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)))
        .returning({ id: editProjects.id, updatedAt: editProjects.updatedAt });

      return c.json({ id: updated.id, updatedAt: updated.updatedAt });
    } catch (error) {
      debugLog.error("Failed to update edit project", {
        service: "editor-route",
        operation: "updateProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update edit project" }, 500);
    }
  },
);

// ─── DELETE /api/editor/:id ──────────────────────────────────────────────────

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
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      await db.delete(editProjects).where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)));

      return c.body(null, 204);
    } catch (error) {
      debugLog.error("Failed to delete edit project", {
        service: "editor-route",
        operation: "deleteProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete edit project" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/export ─────────────────────────────────────────────

app.post(
  "/:id/export",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const parsed = exportSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const [project] = await db
        .select()
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      // Enforce per-user concurrency limit — prevent unbounded background ffmpeg processes.
      const [{ activeJobs }] = await db
        .select({ activeJobs: count() })
        .from(exportJobs)
        .where(and(eq(exportJobs.userId, auth.user.id), eq(exportJobs.status, "rendering")));

      if (activeJobs >= 2) {
        return c.json({ error: "Too many active export jobs. Please wait for a current export to finish." }, 429);
      }

      const [job] = await db
        .insert(exportJobs)
        .values({
          editProjectId: id,
          userId: auth.user.id,
          status: "queued",
          progress: 0,
        })
        .returning();

      // Run ffmpeg render in the background (non-blocking)
      runExportJob(job.id, project, auth.user.id, parsed.data).catch((err) => {
        debugLog.error("Export job failed", {
          service: "editor-route",
          operation: "runExportJob",
          jobId: job.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

      return c.json({ exportJobId: job.id }, 202);
    } catch (error) {
      debugLog.error("Failed to enqueue export", {
        service: "editor-route",
        operation: "enqueueExport",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to enqueue export" }, 500);
    }
  },
);

// ─── GET /api/editor/:id/export/status ───────────────────────────────────────

app.get(
  "/:id/export/status",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

      // Verify project exists and is owned by user before exposing any export data.
      const [project] = await db
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)))
        .limit(1);

      if (!project) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      // Return most recent export job for this project
      const [job] = await db
        .select()
        .from(exportJobs)
        .where(
          and(
            eq(exportJobs.editProjectId, id),
            eq(exportJobs.userId, auth.user.id),
          ),
        )
        .orderBy(desc(exportJobs.createdAt))
        .limit(1);

      if (!job) {
        return c.json({ status: "idle", progress: 0 });
      }

      let r2Url: string | undefined;
      if (job.status === "done" && job.r2Key) {
        r2Url = await getFileUrl(job.r2Key, 3600 * 6).catch(
          () => job.r2Url ?? undefined,
        );
      }

      return c.json({
        status: job.status,
        progress: job.progress,
        r2Url: r2Url ?? job.r2Url ?? undefined,
        error: job.error ?? undefined,
      });
    } catch (error) {
      debugLog.error("Failed to get export status", {
        service: "editor-route",
        operation: "exportStatus",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get export status" }, 500);
    }
  },
);

// ─── ffmpeg render worker ────────────────────────────────────────────────────

interface ClipData {
  assetId: string | null;
  r2Key?: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  volume: number;
  muted: boolean;
  textContent?: string;
  positionX?: number;
  positionY?: number;
  scale?: number;
}

interface TrackData {
  type: "video" | "audio" | "music" | "text";
  muted: boolean;
  clips: ClipData[];
}

async function setJobProgress(jobId: string, progress: number, status = "rendering") {
  await db
    .update(exportJobs)
    .set({ progress, status })
    .where(eq(exportJobs.id, jobId));
}

async function runExportJob(
  jobId: string,
  project: {
    id: string;
    tracks: unknown;
    durationMs: number;
    fps: number;
    resolution: string;
  },
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  const tmpFiles: string[] = [];

  try {
    await db
      .update(exportJobs)
      .set({ status: "rendering", progress: 5 })
      .where(eq(exportJobs.id, jobId));

    const tracks = (project.tracks as TrackData[]) ?? [];
    const fps = opts.fps ?? project.fps ?? 30;
    const resolution = opts.resolution ?? project.resolution ?? "1080p";
    const [outW, outH] =
      resolution === "4k"
        ? [3840, 2160]
        : resolution === "720p"
          ? [1280, 720]
          : [1920, 1080];

    // Collect all asset IDs to resolve R2 keys
    const assetIds = tracks
      .flatMap((t) => t.clips)
      .map((c) => c.assetId)
      .filter((id): id is string => !!id);

    let assetsMap: Record<string, { r2Key: string; type: string }> = {};
    if (assetIds.length > 0) {
      const assets = await db
        .select({
          id: reelAssets.id,
          r2Key: reelAssets.r2Key,
          type: reelAssets.type,
        })
        .from(reelAssets)
        .where(
          and(inArray(reelAssets.id, assetIds), eq(reelAssets.userId, userId)),
        );
      assetsMap = Object.fromEntries(
        assets.map((a) => [a.id, { r2Key: a.r2Key, type: a.type }]),
      );
    }

    await setJobProgress(jobId, 20);

    // Build ffmpeg inputs and filtergraph
    const videoTrack = tracks.find((t) => t.type === "video");
    const audioTrack = tracks.find((t) => t.type === "audio" && !t.muted);
    const musicTrack = tracks.find((t) => t.type === "music" && !t.muted);
    const textTrack = tracks.find((t) => t.type === "text");

    const videoClips = (videoTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );
    const audioClips = (audioTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );
    const musicClips = (musicTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );

    if (videoClips.length === 0) {
      await db
        .update(exportJobs)
        .set({ status: "failed", error: "No video clips on timeline" })
        .where(eq(exportJobs.id, jobId));
      return;
    }

    // Download all needed files to temp
    const downloadToTmp = async (
      r2Key: string,
      ext: string,
    ): Promise<string> => {
      const signedUrl = await getFileUrl(r2Key, 3600);
      const res = await fetch(signedUrl);
      if (!res.ok)
        throw new Error(`Failed to download ${r2Key}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = join(
        tmpdir(),
        `export-${jobId}-${crypto.randomUUID()}.${ext}`,
      );
      writeFileSync(path, buf);
      tmpFiles.push(path);
      return path;
    };

    // Build input list
    const ffmpegInputs: string[] = [];
    const clipPaths: string[] = [];

    for (const clip of videoClips) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp4";
      const path = await downloadToTmp(asset.r2Key, ext);
      clipPaths.push(path);
      ffmpegInputs.push("-i", path);
    }

    await setJobProgress(jobId, 40);

    const audioInputPaths: string[] = [];
    for (const clip of [...audioClips, ...musicClips]) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp3";
      const path = await downloadToTmp(asset.r2Key, ext);
      audioInputPaths.push(path);
      ffmpegInputs.push("-i", path);
    }

    // Build filtergraph
    const filterParts: string[] = [];
    const videoInputCount = videoClips.length;

    // Trim and scale each video clip
    videoClips.forEach((clip, i) => {
      const trimStart = (clip.trimStartMs ?? 0) / 1000;
      const pts =
        clip.speed && clip.speed !== 1
          ? `setpts=${(1 / clip.speed).toFixed(4)}*PTS,`
          : "";
      filterParts.push(
        `[${i}:v]trim=start=${trimStart}:duration=${clip.durationMs / 1000},` +
          `${pts}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
          `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,setpts=PTS-STARTPTS[v${i}]`,
      );
    });

    // Add text overlays via drawtext
    const textClips = textTrack?.clips ?? [];
    let latestVideoLabel = "";

    if (videoInputCount > 1) {
      const concatInputs = videoClips.map((_, i) => `[v${i}]`).join("");
      filterParts.push(
        `${concatInputs}concat=n=${videoInputCount}:v=1:a=0[vconcat]`,
      );
      latestVideoLabel = "vconcat";
    } else {
      latestVideoLabel = "v0";
    }

    // Apply text overlays
    textClips.forEach((clip, i) => {
      if (!clip.textContent) return;
      const startSec = clip.startMs / 1000;
      const endSec = (clip.startMs + clip.durationMs) / 1000;
      const x = clip.positionX ?? 0;
      const y = clip.positionY ?? 0;
      const label = `vtxt${i}`;
      const prevLabel = i === 0 ? latestVideoLabel : `vtxt${i - 1}`;
      // Write text to a temp file to avoid ffmpeg drawtext injection via special characters.
      const textFilePath = join(tmpdir(), `export-${jobId}-text-${i}.txt`);
      writeFileSync(textFilePath, clip.textContent);
      tmpFiles.push(textFilePath);
      filterParts.push(
        `[${prevLabel}]drawtext=textfile='${textFilePath}':fontsize=48:fontcolor=white:` +
          `x=${x}:y=${y}:enable='between(t,${startSec},${endSec})'[${label}]`,
      );
      latestVideoLabel = label;
    });

    // Mix audio
    const allAudioClips = [...audioClips, ...musicClips];
    let finalAudioLabel = "";
    if (allAudioClips.length > 0) {
      allAudioClips.forEach((clip, i) => {
        const inputIdx = videoInputCount + i;
        const vol = (clip.muted ? 0 : (clip.volume ?? 1)).toFixed(2);
        filterParts.push(`[${inputIdx}:a]volume=${vol}[a${i}]`);
      });
      if (allAudioClips.length > 1) {
        const amixInputs = allAudioClips.map((_, i) => `[a${i}]`).join("");
        filterParts.push(
          `${amixInputs}amix=inputs=${allAudioClips.length}[amix]`,
        );
        finalAudioLabel = "amix";
      } else {
        finalAudioLabel = "a0";
      }
    }

    const tmpOut = join(tmpdir(), `export-${jobId}-out.mp4`);
    tmpFiles.push(tmpOut);

    const ffmpegArgs = [
      ...ffmpegInputs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      `[${latestVideoLabel}]`,
    ];

    if (finalAudioLabel) {
      ffmpegArgs.push("-map", `[${finalAudioLabel}]`);
    }

    ffmpegArgs.push(
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "fast",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
    );

    if (finalAudioLabel) {
      ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
    }

    ffmpegArgs.push("-y", tmpOut);

    await setJobProgress(jobId, 55);

    const proc = Bun.spawn(["ffmpeg", ...ffmpegArgs], {
      stderr: "pipe",
      stdout: "ignore",
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `FFmpeg failed (exit ${proc.exitCode}): ${stderr.slice(-800)}`,
      );
    }

    await setJobProgress(jobId, 85);

    // Upload to R2
    const outBuffer = Buffer.from(await Bun.file(tmpOut).arrayBuffer());
    const r2Key = `exports/${userId}/${project.id}/${jobId}.mp4`;
    const r2Url = await uploadFile(outBuffer, r2Key, "video/mp4");

    await db
      .update(exportJobs)
      .set({ status: "done", progress: 100, r2Key, r2Url })
      .where(eq(exportJobs.id, jobId));

    debugLog.info("Export job completed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      r2Key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(exportJobs)
      .set({ status: "failed", error: message.slice(0, 500) })
      .where(eq(exportJobs.id, jobId))
      .catch(() => {});

    debugLog.error("Export job failed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      error: message,
    });
  } finally {
    // Cleanup temp files
    for (const f of tmpFiles) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

export default app;
