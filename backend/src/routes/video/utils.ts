import type { ShotInput } from "../../shared/services/parse-script-shots";
export type { ShotInput } from "../../shared/services/parse-script-shots";
export { parseScriptShots } from "../../shared/services/parse-script-shots";

/** Four synthetic shots for `DEV_MOCK_EXTERNAL_INTEGRATIONS` reel_generate jobs. */
export function buildMockDevReelShots(
  fallbackPrompt: string,
  durationSeconds?: number,
): ShotInput[] {
  const d = Math.min(10, Math.max(3, durationSeconds ?? 5));
  const snippet = fallbackPrompt.trim().slice(0, 200);
  return [0, 1, 2, 3].map((i) => ({
    shotIndex: i,
    description: `[mock ${i + 1}/4] ${snippet}`,
    durationSeconds: d,
  }));
}

export function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped - Math.floor(clamped)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function extractCaptionSourceText(input: {
  cleanScriptForAudio: string | null;
  generatedScript: string | null;
}): string {
  const source = (
    input.cleanScriptForAudio ??
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

