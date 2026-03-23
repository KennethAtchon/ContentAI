import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/media",
);

/** Four distinct MP4s rotated by `shotIndex` for mocked reel shots. */
export const DEV_MOCK_CLIP_FILENAMES = [
  "dev-mock-clip-1.mp4",
  "dev-mock-clip-2.mp4",
  "dev-mock-clip-3.mp4",
  "dev-mock-clip-4.mp4",
] as const;

const VOICE_NAME = "dev-mock-voiceover.mp3";

const clipBuffers: (Buffer | null)[] = [null, null, null, null];
let voiceBuffer: Buffer | null = null;

function assertFixture(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(
      `[dev-fixtures] Missing ${label} at ${path}. See backend/fixtures/media/README.md for download URLs.`,
    );
  }
}

function normalizeShotSlot(shotIndex: number): number {
  if (!Number.isFinite(shotIndex)) return 0;
  const i = Math.floor(shotIndex) % 4;
  return i < 0 ? i + 4 : i;
}

/**
 * Cached MP4 bytes for mocked video clip generation.
 * Picks `dev-mock-clip-{1..4}.mp4` from `shotIndex` so each reel shot can differ.
 */
export function getDevMockVideoBufferForShot(shotIndex: number): Buffer {
  const slot = normalizeShotSlot(shotIndex);
  if (!clipBuffers[slot]) {
    const name = DEV_MOCK_CLIP_FILENAMES[slot]!;
    const path = join(FIXTURE_DIR, name);
    assertFixture(path, name);
    clipBuffers[slot] = readFileSync(path);
  }
  return clipBuffers[slot]!;
}

/** Cached MP3 bytes for mocked ElevenLabs TTS. */
export function getDevMockVoiceBuffer(): Buffer {
  if (!voiceBuffer) {
    const path = join(FIXTURE_DIR, VOICE_NAME);
    assertFixture(path, VOICE_NAME);
    voiceBuffer = readFileSync(path);
  }
  return voiceBuffer;
}

/** Matches `elevenlabs.ts` heuristic (~128 kbps) for stable `durationMs`. */
export function estimateMp3DurationMsFromBufferSize(byteLength: number): number {
  return Math.round((byteLength / 16000) * 1000);
}
