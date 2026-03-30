import {
  MAX_SCRIPT_SHOT_DURATION_SECONDS,
  MIN_SCRIPT_SHOT_DURATION_SECONDS,
} from "./video-shot-durations";
import { debugLog } from "../../utils/debug/debug";

export type ShotInput = {
  shotIndex: number;
  description: string;
  durationSeconds: number;
};

/** Used by the video generation job (`runReelGeneration`) only — not the editor timeline. */
export function parseScriptShots(script: string | null): ShotInput[] {
  if (!script) return [];

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

    const span = end - start;
    const durationSeconds = Math.min(
      MAX_SCRIPT_SHOT_DURATION_SECONDS,
      Math.max(MIN_SCRIPT_SHOT_DURATION_SECONDS, span),
    );
    shots.push({
      shotIndex: shots.length,
      description: text,
      durationSeconds,
    });
    validLines.push(line);
  }

  if (shots.length === 0) {
    if (invalidLines.length > 0) {
      throw new Error(
        `No valid script shots found. All lines failed to parse. Expected format: "[0-5] A person walking on beach". Invalid lines:\n${invalidLines.map((line) => `  - "${line}"`).join("\n")}`,
      );
    }
    throw new Error(
      `No valid script shots found. Expected format: "[0-5] A person walking on beach" where numbers represent seconds`,
    );
  }

  if (invalidLines.length > 0 && invalidLines.length > lines.length / 2) {
    debugLog.warn(
      `More than half of script lines failed to parse (${invalidLines.length}/${lines.length}). ` +
        `Expected format: "[start-end] description". Invalid lines:\n${invalidLines.map((line) => `  - "${line}"`).join("\n")}`,
    );
  }

  return shots.slice(0, 12);
}
