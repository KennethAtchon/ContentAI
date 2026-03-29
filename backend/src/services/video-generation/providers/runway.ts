import { safeFetch } from "@/services/api/safe-fetch";
import { resolveVideoOutputDurationSeconds } from "@/services/media/dev-fixtures/estimate-mp4-duration";
import { storage } from "@/services/storage";
import { RUNWAY_API_KEY, RUNWAY_MODEL } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { systemConfigService } from "@/domain/singletons";
import type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoGenerationProvider,
} from "../types";
import {
  RUNWAY_API_DURATION_MAX,
  RUNWAY_API_DURATION_MIN,
} from "../provider-duration-limits";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 300_000; // 5 min

// Cost per second by model
const COST_PER_SECOND: Record<string, number> = {
  gen3a_turbo: 0.05,
  gen3a: 0.1,
};

interface RunwayTask {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string[];
  failure?: string;
}

async function pollTask(taskId: string, apiKey: string): Promise<RunwayTask> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await safeFetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
      timeout: 15_000,
    });

    if (!res.ok) continue;

    const task = (await res.json()) as RunwayTask;

    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED") {
      throw new Error(
        `Runway task ${taskId} failed: ${task.failure ?? "unknown"}`,
      );
    }
  }

  throw new Error(`Runway task ${taskId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

export const runwayProvider: VideoGenerationProvider = {
  name: "runway",

  async isAvailable() {
    return systemConfigService.hasApiKey("runway", RUNWAY_API_KEY);
  },

  estimateCost(durationSeconds: number) {
    const costPerSec = COST_PER_SECOND[RUNWAY_MODEL ?? "gen3a_turbo"] ?? 0.05;
    return durationSeconds * costPerSec;
  },

  async generate(params: GenerateVideoClipParams): Promise<VideoClipResult> {
    const startMs = Date.now();
    const apiKey = await systemConfigService.getApiKey(
      "runway",
      RUNWAY_API_KEY,
    );
    const model =
      RUNWAY_MODEL ||
      (await systemConfigService.get("video", "runway_model")) ||
      "gen3a_turbo";
    const apiDuration = Math.min(
      RUNWAY_API_DURATION_MAX,
      Math.max(RUNWAY_API_DURATION_MIN, params.durationSeconds),
    );

    if (!apiKey) throw new Error("RUNWAY_API_KEY is not configured");

    debugLog.info("Generating video clip via Runway", {
      service: "runway",
      operation: "generate",
      model,
      prompt: params.prompt.slice(0, 80),
      duration: apiDuration,
    });

    const res = await safeFetch(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        promptText: params.prompt,
        model,
        ratio: params.aspectRatio === "16:9" ? "1280:768" : "768:1280",
        duration: apiDuration,
      }),
      timeout: 30_000,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Runway submit failed (${res.status}): ${body}`);
    }

    const { id: taskId } = (await res.json()) as { id: string };
    const task = await pollTask(taskId, apiKey);

    const videoUrl = task.output?.[0];
    if (!videoUrl) throw new Error("Runway returned no video URL");

    const r2Key = `video-clips/${params.userId ?? "anon"}/${Date.now()}-runway.mp4`;
    const videoRes = await safeFetch(videoUrl, {
      headers: { "User-Agent": "ContentAI-Scraper/1.0" },
      timeout: 300_000,
      validateResponse: () => true,
    });
    if (!videoRes.ok) {
      const errBody = await videoRes.text().catch(() => "");
      throw new Error(
        `Failed to download Runway video (${videoRes.status}): ${errBody.slice(0, 240)}`,
      );
    }
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    const r2Url = await storage.uploadFile(buffer, r2Key, "video/mp4");
    const durationSeconds = resolveVideoOutputDurationSeconds(
      buffer,
      apiDuration,
    );

    return {
      r2Key,
      r2Url,
      durationSeconds,
      provider: "runway",
      costUsd: this.estimateCost(durationSeconds),
      generationTimeMs: Date.now() - startMs,
    };
  },
};
