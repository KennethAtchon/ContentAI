import { debugLog } from "../../utils/debug/debug";

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

export function parseScriptShots(script: string | null): ShotInput[] {
  if (!script) return [];

  // Normalise: replace literal \n sequences and Windows line endings, then split
  const lines = script
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (lines.length === 0) {
    return [];
  }

  const shots: ShotInput[] = [];
  // Accept hyphen, en dash (–), or em dash (—) as the range separator
  const timingRegex = /^\[(\d+)(?::\d+)?[-–—](\d+)(?::\d+)?s?\]\s*(.+)$/i;
  const validLines: string[] = [];
  const invalidLines: string[] = [];

  for (const line of lines) {
    const match = line.match(timingRegex);
    if (!match) {
      invalidLines.push(line);
      continue;
    }

    const start = Number(match[1]);
    const end = Number(match[2]);
    const text = match[3]?.trim();

    // Validate timing format
    if (isNaN(start) || isNaN(end)) {
      throw new Error(
        `Invalid timing values in line: "${line}". Expected format: [start-end] description`,
      );
    }

    if (start < 0 || end < 0) {
      throw new Error(`Negative timing values not allowed in line: "${line}"`);
    }

    if (end <= start) {
      throw new Error(
        `End time must be greater than start time in line: "${line}"`,
      );
    }

    if (!text) {
      throw new Error(
        `Description cannot be empty in line: "${line}". Expected format: [start-end] description`,
      );
    }

    if (text.length < 3) {
      throw new Error(
        `Description too short (minimum 3 characters) in line: "${line}"`,
      );
    }

    if (text.length > 1000) {
      throw new Error(
        `Description too long (maximum 1000 characters) in line: "${line}"`,
      );
    }

    const durationSeconds = Math.max(3, Math.min(10, end - start || 5));
    shots.push({
      shotIndex: shots.length,
      description: text,
      durationSeconds,
    });
    validLines.push(line);
  }

  // Assert that we found at least one valid shot
  if (shots.length === 0) {
    if (invalidLines.length > 0) {
      throw new Error(
        `No valid script shots found. All lines failed to parse. Expected format: "[0-5] A person walking on beach". Invalid lines:\n${invalidLines.map((line) => `  - "${line}"`).join("\n")}`,
      );
    } else {
      throw new Error(
        `No valid script shots found. Expected format: "[0-5] A person walking on beach" where numbers represent seconds`,
      );
    }
  }

  // Assert that the majority of lines are valid (warn if many invalid lines)
  if (invalidLines.length > 0 && invalidLines.length > lines.length / 2) {
    debugLog.warn(
      `More than half of script lines failed to parse (${invalidLines.length}/${lines.length}). ` +
        `Expected format: "[start-end] description". Invalid lines:\n${invalidLines.map((line) => `  - "${line}"`).join("\n")}`,
    );
  }

  return shots.slice(0, 12);
}
