import { safeFetch } from "@/services/api/safe-fetch";
import { storage } from "@/services/storage";
import { FAL_API_KEY, KLING_MODEL } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoGenerationProvider,
} from "../types";

const FAL_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000; // 5 min

interface FalQueueResponse {
  request_id: string;
  status: string;
  queue_position?: number;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  logs?: Array<{ message: string }>;
}

interface FalResultResponse {
  video?: { url: string; content_type: string };
  error?: string;
}

async function submitJob(
  model: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await safeFetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 30_000,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal.ai submit failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as FalQueueResponse;
  return data.request_id;
}

async function pollUntilComplete(
  model: string,
  requestId: string,
): Promise<FalResultResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await safeFetch(
      `${FAL_BASE}/${model}/requests/${requestId}/status`,
      {
        headers: { Authorization: `Key ${FAL_API_KEY}` },
        timeout: 15_000,
      },
    );

    if (!statusRes.ok) continue;

    const status = (await statusRes.json()) as FalStatusResponse;

    if (status.status === "COMPLETED") {
      const resultRes = await safeFetch(
        `${FAL_BASE}/${model}/requests/${requestId}`,
        {
          headers: { Authorization: `Key ${FAL_API_KEY}` },
          timeout: 15_000,
        },
      );
      return (await resultRes.json()) as FalResultResponse;
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai job ${requestId} failed`);
    }
  }

  throw new Error(
    `fal.ai job ${requestId} timed out after ${POLL_TIMEOUT_MS}ms`,
  );
}

export const klingFalProvider: VideoGenerationProvider = {
  name: "kling-fal",

  isAvailable() {
    return !!FAL_API_KEY;
  },

  estimateCost(durationSeconds: number) {
    // Kling 3.0 via fal.ai: ~$0.029/sec
    return durationSeconds * 0.029;
  },

  async generate(params: GenerateVideoClipParams): Promise<VideoClipResult> {
    const startMs = Date.now();
    const model = KLING_MODEL;
    const duration = Math.min(Math.max(params.durationSeconds, 3), 10);

    debugLog.info("Generating video clip via Kling/fal.ai", {
      service: "kling-fal",
      operation: "generate",
      prompt: params.prompt.slice(0, 80),
      duration,
    });

    const requestId = await submitJob(model, {
      prompt: params.prompt,
      duration,
      aspect_ratio: params.aspectRatio ?? "9:16",
    });

    const result = await pollUntilComplete(model, requestId);

    if (!result.video?.url) {
      throw new Error("fal.ai returned no video URL");
    }

    const r2Key = `video-clips/${params.userId ?? "anon"}/${Date.now()}-kling.mp4`;
    const r2Url = await storage.uploadFromUrl(
      result.video.url,
      r2Key,
      "video/mp4",
    );

    return {
      r2Key,
      r2Url,
      durationSeconds: duration,
      provider: "kling-fal",
      costUsd: this.estimateCost(duration),
      generationTimeMs: Date.now() - startMs,
    };
  },
};
