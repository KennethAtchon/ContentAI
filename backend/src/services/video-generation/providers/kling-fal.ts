import { systemLogger } from "@/utils/system/system-logger";
import { safeFetch } from "@/services/http/safe-fetch";
import { resolveVideoOutputDurationSeconds } from "@/services/video-generation/dev-fixtures/estimate-mp4-duration";
import { storage } from "@/services/storage";
import { FAL_API_KEY, KLING_MODEL } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { systemConfigService } from "@/domain/singletons";
import type {
  GenerateVideoClipParams,
  VideoClipResult,
  VideoGenerationProvider,
} from "../types";
import {
  KLING_API_DURATION_MAX,
  KLING_API_DURATION_MIN,
} from "../provider-duration-limits";

const FAL_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 300_000; // 5 min

interface FalQueueResponse {
  request_id: string;
  status: string;
  queue_position?: number;
  response_url?: string;
  status_url?: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  logs?: Array<{ message: string }>;
  response_url?: string;
}

interface FalResultResponse {
  video?: { url: string; content_type: string };
  error?: string;
}

async function submitJob(
  model: string,
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<FalQueueResponse> {
  const url = `${FAL_BASE}/${model}`;

  debugLog.info("[kling-fal] Submitting job to fal.ai", {
    service: "kling-fal",
    operation: "submitJob",
    url,
    payload,
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) + "..." : "MISSING",
  });

  const res = await safeFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 30_000,
    validateResponse: () => true, // Let caller handle errors with full body
  });

  const body = await res.text();

  debugLog.info("[kling-fal] Submit response", {
    service: "kling-fal",
    operation: "submitJob",
    status: res.status,
    statusText: res.statusText,
    body,
  });

  if (!res.ok) {
    throw new Error(
      `fal.ai submit failed (${res.status} ${res.statusText}): ${body}`,
    );
  }

  let data: FalQueueResponse;
  try {
    data = JSON.parse(body) as FalQueueResponse;
  } catch {
    throw new Error(`fal.ai submit returned non-JSON (${res.status}): ${body}`);
  }

  debugLog.info("[kling-fal] Job submitted successfully", {
    service: "kling-fal",
    operation: "submitJob",
    requestId: data.request_id,
    status: data.status,
    queuePosition: data.queue_position,
    responseUrl: data.response_url,
    statusUrl: data.status_url,
  });

  return data;
}

async function pollUntilComplete(
  model: string,
  job: FalQueueResponse,
  apiKey: string,
): Promise<FalResultResponse> {
  const { request_id: requestId } = job;
  const statusUrl = `${FAL_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_BASE}/${model}/requests/${requestId}`;

  debugLog.info("[kling-fal] Polling config", {
    service: "kling-fal",
    operation: "pollUntilComplete",
    requestId,
    statusUrl,
    resultUrl,
    model,
  });

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let pollCount = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pollCount++;

    // statusUrl is already the full URL

    debugLog.info("[kling-fal] Polling job status", {
      service: "kling-fal",
      operation: "pollUntilComplete",
      requestId,
      pollCount,
      url: statusUrl,
    });

    const statusRes = await safeFetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
      timeout: 15_000,
      validateResponse: () => true,
    });

    const statusBody = await statusRes.text();

    debugLog.info("[kling-fal] Poll response", {
      service: "kling-fal",
      operation: "pollUntilComplete",
      requestId,
      pollCount,
      httpStatus: statusRes.status,
      body: statusBody,
    });

    if (!statusRes.ok) {
      systemLogger.warn("[kling-fal] Status poll non-OK, continuing", {
        service: "kling-fal",
        operation: "pollUntilComplete",
        requestId,
        httpStatus: statusRes.status,
        body: statusBody,
      });
      continue;
    }

    let status: FalStatusResponse;
    try {
      status = JSON.parse(statusBody) as FalStatusResponse;
    } catch {
      systemLogger.warn("[kling-fal] Status poll returned non-JSON, continuing", {
        service: "kling-fal",
        operation: "pollUntilComplete",
        requestId,
        body: statusBody,
      });
      continue;
    }

    debugLog.info("[kling-fal] Job status", {
      service: "kling-fal",
      operation: "pollUntilComplete",
      requestId,
      jobStatus: status.status,
      logs: status.logs,
    });

    if (status.status === "COMPLETED") {
      const fetchUrl = status.response_url ?? resultUrl;

      debugLog.info("[kling-fal] Fetching completed result", {
        service: "kling-fal",
        operation: "pollUntilComplete",
        requestId,
        fetchUrl,
        source: status.response_url ? "status_body" : "fallback",
      });

      const resultRes = await safeFetch(fetchUrl, {
        headers: { Authorization: `Key ${apiKey}` },
        timeout: 15_000,
        validateResponse: () => true,
      });

      const resultBody = await resultRes.text();

      debugLog.info("[kling-fal] Result response", {
        service: "kling-fal",
        operation: "pollUntilComplete",
        requestId,
        httpStatus: resultRes.status,
        body: resultBody,
      });

      if (!resultRes.ok) {
        throw new Error(
          `fal.ai result fetch failed (${resultRes.status}): ${resultBody}`,
        );
      }

      return JSON.parse(resultBody) as FalResultResponse;
    }

    if (status.status === "FAILED") {
      throw new Error(
        `fal.ai job ${requestId} failed. Logs: ${JSON.stringify(status.logs ?? [])}`,
      );
    }
  }

  throw new Error(
    `fal.ai job ${requestId} timed out after ${POLL_TIMEOUT_MS}ms`,
  );
}

export const klingFalProvider: VideoGenerationProvider = {
  name: "kling-fal",

  async isAvailable() {
    return systemConfigService.hasApiKey("fal", FAL_API_KEY);
  },

  estimateCost(durationSeconds: number) {
    // Kling 3.0 via fal.ai: ~$0.029/sec
    return durationSeconds * 0.029;
  },

  async generate(params: GenerateVideoClipParams): Promise<VideoClipResult> {
    const startMs = Date.now();
    const apiKey = await systemConfigService.getApiKey("fal", FAL_API_KEY);
    const model =
      KLING_MODEL ||
      (await systemConfigService.get("video", "kling_model")) ||
      "fal-ai/kling-video/v2.1/standard/text-to-video";
    const apiDuration = Math.min(
      KLING_API_DURATION_MAX,
      Math.max(KLING_API_DURATION_MIN, params.durationSeconds),
    );

    if (!apiKey) throw new Error("FAL_API_KEY is not configured");

    debugLog.info("[kling-fal] Starting clip generation", {
      service: "kling-fal",
      operation: "generate",
      model,
      prompt: params.prompt,
      duration: apiDuration,
      aspectRatio: params.aspectRatio ?? "9:16",
      userId: params.userId,
    });

    const job = await submitJob(
      model,
      {
        prompt: params.prompt,
        duration: apiDuration,
        aspect_ratio: params.aspectRatio ?? "9:16",
      },
      apiKey,
    );

    const result = await pollUntilComplete(model, job, apiKey);

    debugLog.info("[kling-fal] Generation complete, uploading to R2", {
      service: "kling-fal",
      operation: "generate",
      requestId: job.request_id,
      videoUrl: result.video?.url,
      resultError: result.error,
    });

    if (!result.video?.url) {
      throw new Error(
        `fal.ai returned no video URL. Full result: ${JSON.stringify(result)}`,
      );
    }

    const r2Key = `video-clips/${params.userId ?? "anon"}/${Date.now()}-kling.mp4`;
    const videoRes = await safeFetch(result.video.url, {
      headers: { "User-Agent": "ContentAI-Scraper/1.0" },
      timeout: 300_000,
      validateResponse: () => true,
    });
    if (!videoRes.ok) {
      const errBody = await videoRes.text().catch(() => "");
      throw new Error(
        `Failed to download generated video (${videoRes.status}): ${errBody.slice(0, 240)}`,
      );
    }
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    const r2Url = await storage.uploadFile(buffer, r2Key, "video/mp4");
    const durationSeconds = resolveVideoOutputDurationSeconds(
      buffer,
      apiDuration,
    );

    debugLog.info("[kling-fal] Uploaded to R2", {
      service: "kling-fal",
      operation: "generate",
      r2Key,
      r2Url,
      generationTimeMs: Date.now() - startMs,
      durationSeconds,
    });

    return {
      r2Key,
      r2Url,
      durationSeconds,
      provider: "kling-fal",
      costUsd: this.estimateCost(durationSeconds),
      generationTimeMs: Date.now() - startMs,
    };
  },
};
