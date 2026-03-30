export type { ShotInput } from "../../domain/video/reel-shot-helpers";
export {
  parseScriptShots,
  buildMockDevReelShots,
  durationSecondsToMs,
} from "../../domain/video/reel-shot-helpers";

export function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped - Math.floor(clamped)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function extractCaptionSourceText(input: {
  voiceoverScript: string | null;
  generatedScript: string | null;
}): string {
  const source = (
    input.voiceoverScript ??
    input.generatedScript ??
    ""
  ).trim();
  if (!source) return "";
  return source
    .replace(/^\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveUseClipAudioByIndex(
  shotAssets: Array<{ metadata: unknown }>,
): boolean[] {
  return shotAssets.map((asset) => {
    const metadata = (asset.metadata as Record<string, unknown> | null) ?? {};
    return Boolean(metadata.useClipAudio);
  });
}
