import { safeFetch } from "@/services/api/safe-fetch";
import { storage } from "@/services/storage";
import { RUNWAY_API_KEY, RUNWAY_MODEL } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoGenerationProvider,
} from "../types";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 300_000; // 5 min

// Cost per second by model
const COST_PER_SECOND: Record<string, number> = {
  "gen3a_turbo": 0.05,
  "gen3a": 0.10,
};

interface RunwayTask {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string[];
  failure?: string;
}

async function pollTask(taskId: string): Promise<RunwayTask> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await safeFetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
      },
      timeout: 15_000,
    });

    if (!res.ok) continue;

    const task = (await res.json()) as RunwayTask;

    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED") {
      throw new Error(`Runway task ${taskId} failed: ${task.failure ?? "unknown"}`);
    }
  }

  throw new Error(`Runway task ${taskId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

export const runwayProvider: VideoGenerationProvider = {
  name: "runway",

  isAvailable() {
    return !!RUNWAY_API_KEY;
  },

  estimateCost(durationSeconds: number) {
    const costPerSec = COST_PER_SECOND[RUNWAY_MODEL] ?? 0.05;
    return durationSeconds * costPerSec;
  },

  async generate(params: GenerateVideoClipParams): Promise<VideoClipResult> {
    const startMs = Date.now();
    const duration = Math.min(Math.max(params.durationSeconds, 3), 10);

    debugLog.info("Generating video clip via Runway", {
      service: "runway",
      operation: "generate",
      model: RUNWAY_MODEL,
      prompt: params.prompt.slice(0, 80),
      duration,
    });

    const res = await safeFetch(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        promptText: params.prompt,
        model: RUNWAY_MODEL,
        ratio: params.aspectRatio === "16:9" ? "1280:768" : "768:1280",
        duration,
      }),
      timeout: 30_000,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Runway submit failed (${res.status}): ${body}`);
    }

    const { id: taskId } = (await res.json()) as { id: string };
    const task = await pollTask(taskId);

    const videoUrl = task.output?.[0];
    if (!videoUrl) throw new Error("Runway returned no video URL");

    const r2Key = `video-clips/${params.userId ?? "anon"}/${Date.now()}-runway.mp4`;
    const r2Url = await storage.uploadFromUrl(videoUrl, r2Key, "video/mp4");

    return {
      r2Key,
      r2Url,
      durationSeconds: duration,
      provider: "runway",
      costUsd: this.estimateCost(duration),
      generationTimeMs: Date.now() - startMs,
    };
  },
};
