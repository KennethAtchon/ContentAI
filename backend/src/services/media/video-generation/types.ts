export type VideoProvider = "kling-fal" | "runway" | "image-ken-burns";

export interface GenerateVideoClipParams {
  prompt: string;
  durationSeconds: number; // 3–10
  aspectRatio?: "9:16" | "16:9" | "1:1";
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoClipResult {
  r2Key: string;
  r2Url: string;
  durationSeconds: number;
  provider: VideoProvider;
  costUsd: number;
  generationTimeMs: number;
}

export interface VideoGenerationProvider {
  readonly name: VideoProvider;
  isAvailable(): Promise<boolean>;
  estimateCost(durationSeconds: number): number;
  generate(params: GenerateVideoClipParams): Promise<VideoClipResult>;
}
