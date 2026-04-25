/**
 * Timeline timecode helpers.
 * - `formatHHMMSSFF` / `formatMMSS`: display
 * - `parseTimecode`: jump input — 4 parts HH:MM:SS:FF, 3 parts HH:MM:SS, 2 parts MM:SS
 */

export function formatHHMMSSFF(ms: number, fps: number): string {
  const totalFrames = Math.floor((ms / 1000) * fps);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return [
    String(hh).padStart(2, "0"),
    String(mm).padStart(2, "0"),
    String(ss).padStart(2, "0"),
    String(ff).padStart(2, "0"),
  ].join(":");
}

export function formatMMSS(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Display-only formatter: HH:MM:SS.d (tenths of a second).
 * Used in the preview overlay where frame numbers would be misleading.
 */
export function formatHHMMSSd(ms: number): string {
  const totalDs = Math.floor(ms / 100); // deciseconds
  const d = totalDs % 10;
  const totalSec = Math.floor(totalDs / 10);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return (
    [
      String(hh).padStart(2, "0"),
      String(mm).padStart(2, "0"),
      String(ss).padStart(2, "0"),
    ].join(":") +
    "." +
    d
  );
}

/** Parse timecode string to milliseconds, or null if invalid. */
export function parseTimecode(raw: string, fps: number): number | null {
  const parts = raw.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let ff = 0;
  if (parts.length === 4) {
    [hh, mm, ss, ff] = parts;
  } else if (parts.length === 3) {
    // HH:MM:SS (most common three-part entry; not minutes:seconds:frames)
    [hh, mm, ss] = parts;
    ff = 0;
  } else if (parts.length === 2) {
    // MM:SS
    [mm, ss] = parts;
    ff = 0;
  } else {
    return null;
  }
  return (hh * 3600 + mm * 60 + ss) * 1000 + Math.round((ff / fps) * 1000);
}
