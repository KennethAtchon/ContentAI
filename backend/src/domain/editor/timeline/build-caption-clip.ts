import type { CaptionClip } from "../../../types/timeline.types";

export function buildCaptionClip({
  captionDocId,
  voiceoverAsset,
  voiceoverClipId,
}: {
  captionDocId: string;
  voiceoverAsset: { id: string; durationMs: number | null };
  voiceoverClipId: string | null;
}): CaptionClip {
  const durationMs = voiceoverAsset.durationMs ?? 0;
  return {
    id: crypto.randomUUID(),
    type: "caption",
    startMs: 0,
    durationMs,
    originVoiceoverClipId: voiceoverClipId,
    captionDocId,
    sourceStartMs: 0,
    sourceEndMs: durationMs,
    stylePresetId: "hormozi",
    styleOverrides: {},
    groupingMs: 800,
  };
}
