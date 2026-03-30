import { safeFetch } from "@/services/http/safe-fetch";
import { resolveVideoOutputDurationSeconds } from "@/services/video-generation/dev-fixtures/estimate-mp4-duration";
import { storage } from "@/services/storage";
import { FAL_API_KEY, FLUX_MODEL } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { systemConfigService } from "@/domain/singletons";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoGenerationProvider,
} from "../types";
import {
  KEN_BURNS_DURATION_MAX,
  KEN_BURNS_DURATION_MIN,
} from "../provider-duration-limits";

// ~$0.003 per FLUX Schnell image, negligible compute for FFmpeg
const COST_PER_CLIP = 0.006;

const FAL_BASE = "https://fal.run";

interface FluxResult {
  images: Array<{ url: string; content_type: string }>;
}

async function generateImage(
  prompt: string,
  apiKey: string,
  fluxModel: string,
): Promise<Buffer> {
  const res = await safeFetch(`${FAL_BASE}/${fluxModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "portrait_4_3", // close to 9:16 portrait
      num_images: 1,
    }),
    timeout: 60_000,
    retryAttempts: 2,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FLUX image generation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as FluxResult;
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error("FLUX returned no image URL");

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("Failed to download generated image");

  return Buffer.from(await imgRes.arrayBuffer());
}

async function applyKenBurns(
  imageBuffer: Buffer,
  durationSeconds: number,
  aspectRatio: "9:16" | "16:9" | "1:1",
): Promise<Buffer> {
  const tmpIn = join(tmpdir(), `kb-in-${Date.now()}.jpg`);
  const tmpOut = join(tmpdir(), `kb-out-${Date.now()}.mp4`);

  await Bun.write(tmpIn, imageBuffer);

  // Target resolution per aspect ratio
  const resolutions: Record<string, string> = {
    "9:16": "1080:1920",
    "16:9": "1920:1080",
    "1:1": "1080:1080",
  };
  const [outW, outH] = (resolutions[aspectRatio] ?? "1080:1920")
    .split(":")
    .map(Number);
  const fps = 25;
  const totalFrames = durationSeconds * fps;

  // Ken Burns: slow zoom in from 1.0x to 1.3x, centered
  const ffmpegArgs = [
    "-loop",
    "1",
    "-i",
    tmpIn,
    "-vf",
    [
      `scale=${outW * 2}:${outH * 2}`,
      `zoompan=z='min(zoom+${(0.3 / totalFrames).toFixed(6)},1.3)':`,
      `d=${totalFrames}:`,
      `x='iw/2-(iw/zoom/2)':`,
      `y='ih/2-(ih/zoom/2)',`,
      `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,`,
      `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black`,
    ].join(""),
    "-t",
    String(durationSeconds),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-pix_fmt",
    "yuv420p",
    "-y",
    tmpOut,
  ];

  const proc = Bun.spawn(["ffmpeg", ...ffmpegArgs], {
    stderr: "pipe",
    stdout: "ignore",
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      `FFmpeg Ken Burns failed (exit ${proc.exitCode}): ${stderr.slice(-500)}`,
    );
  }

  const output = await Bun.file(tmpOut).arrayBuffer();

  // Cleanup temp files
  for (const f of [tmpIn, tmpOut]) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      // Ignore cleanup errors
    }
  }

  return Buffer.from(output);
}

export const imageKenBurnsProvider: VideoGenerationProvider = {
  name: "image-ken-burns",

  async isAvailable() {
    return systemConfigService.hasApiKey("fal", FAL_API_KEY);
  },

  estimateCost(_durationSeconds: number) {
    return COST_PER_CLIP;
  },

  async generate(params: GenerateVideoClipParams): Promise<VideoClipResult> {
    const startMs = Date.now();
    const apiKey = await systemConfigService.getApiKey("fal", FAL_API_KEY);
    const fluxModel =
      FLUX_MODEL ||
      (await systemConfigService.get("video", "flux_model")) ||
      "fal-ai/flux/schnell";
    const duration = Math.min(
      KEN_BURNS_DURATION_MAX,
      Math.max(KEN_BURNS_DURATION_MIN, params.durationSeconds),
    );
    const aspectRatio = params.aspectRatio ?? "9:16";

    if (!apiKey) throw new Error("FAL_API_KEY is not configured");

    debugLog.info("Generating video clip via Image+KenBurns", {
      service: "image-ken-burns",
      operation: "generate",
      prompt: params.prompt.slice(0, 80),
      duration,
    });

    const imageBuffer = await generateImage(params.prompt, apiKey, fluxModel);
    const videoBuffer = await applyKenBurns(imageBuffer, duration, aspectRatio);

    const r2Key = `video-clips/${params.userId ?? "anon"}/${Date.now()}-kb.mp4`;
    const r2Url = await storage.uploadFile(videoBuffer, r2Key, "video/mp4");
    const durationSeconds = resolveVideoOutputDurationSeconds(
      videoBuffer,
      duration,
    );

    return {
      r2Key,
      r2Url,
      durationSeconds,
      provider: "image-ken-burns",
      costUsd: COST_PER_CLIP,
      generationTimeMs: Date.now() - startMs,
    };
  },
};
