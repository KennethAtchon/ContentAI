/**
 * FFmpeg filter helpers for timeline export.
 * Keep aligned with preview/export semantics in the editor feature.
 */

/** Chain ffmpeg `atempo` filters (each accepts 0.5–2.0) to match clip playback speed. */
export function buildFfmpegAtempoChain(speed: number): string {
  if (!speed || Math.abs(speed - 1) < 1e-6) return "";
  let s = speed;
  const parts: string[] = [];
  while (s > 2 + 1e-6) {
    parts.push("atempo=2");
    s /= 2;
  }
  while (s < 0.5 - 1e-6) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-6) {
    parts.push(`atempo=${s.toFixed(4)}`);
  }
  return parts.join(",");
}
