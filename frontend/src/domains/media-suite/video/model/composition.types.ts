/**
 * Legacy composition / timeline shape used by video tooling tests and optional UI.
 */

export interface TimelineVideoItem {
  id: string;
  startMs: number;
  endMs: number;
  assetId?: string;
}

export interface Timeline {
  schemaVersion: number;
  fps: number;
  durationMs: number;
  tracks: {
    video: TimelineVideoItem[];
    audio: unknown[];
    text: unknown[];
    captions: unknown[];
  };
}
