import {
  MAX_SCRIPT_SHOT_DURATION_SECONDS,
  MIN_SCRIPT_SHOT_DURATION_SECONDS,
} from "./video-shot-durations";
import type { ShotInput } from "./parse-script-shots";
export type { ShotInput } from "./parse-script-shots";
export { parseScriptShots } from "./parse-script-shots";

/** Four synthetic shots for `DEV_MOCK_EXTERNAL_INTEGRATIONS` reel_generate jobs. */
export function buildMockDevReelShots(
  fallbackPrompt: string,
  durationSeconds?: number,
): ShotInput[] {
  const d = Math.min(
    MAX_SCRIPT_SHOT_DURATION_SECONDS,
    Math.max(MIN_SCRIPT_SHOT_DURATION_SECONDS, durationSeconds ?? 5),
  );
  const snippet = fallbackPrompt.trim().slice(0, 200);
  return [0, 1, 2, 3].map((i) => ({
    shotIndex: i,
    description: `[mock ${i + 1}/4] ${snippet}`,
    durationSeconds: d,
  }));
}

/** Integer ms for DB `duration_ms` — clip durations may be fractional (e.g. MP4 probe). */
export function durationSecondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}
