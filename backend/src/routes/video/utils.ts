export type ShotInput = {
  shotIndex: number;
  description: string;
  durationSeconds: number;
};

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
  const source = (input.cleanScriptForAudio ?? input.generatedScript ?? "").trim();
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

export function parseScriptShots(script: string | null): ShotInput[] {
  if (!script) return [];

  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const shots: ShotInput[] = [];
  const timingRegex = /^\[(\d+)(?::\d+)?-(\d+)(?::\d+)?s?\]\s*(.+)$/i;

  for (const line of lines) {
    const m = line.match(timingRegex);
    if (!m) continue;
    const start = Number(m[1]);
    const end = Number(m[2]);
    const text = m[3]?.trim();
    if (!text) continue;
    const durationSeconds = Math.max(3, Math.min(10, end - start || 5));
    shots.push({
      shotIndex: shots.length,
      description: text,
      durationSeconds,
    });
  }

  return shots.slice(0, 12);
}
