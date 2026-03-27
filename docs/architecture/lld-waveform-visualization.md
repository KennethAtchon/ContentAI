# LLD: Waveform Visualization on Timeline Clips

**Feature:** 1.6 — Missing Waveforms on Voiceover and Shot Audio
**Phase:** Single-phase (complete implementation)

---

## Current State & Root Cause

### What exists

`frontend/src/features/editor/hooks/use-waveform.ts` — a WaveSurfer.js v7 wrapper that:
1. Maintains a module-level LRU cache of up to 20 `WaveSurfer` instances, keyed by **audio URL**
2. Creates a new `WaveSurfer` instance (which fetches and decodes the audio internally) if no cache hit
3. On cache hit, calls `existing.setOptions({ container, waveColor, height })` to re-attach the renderer

`frontend/src/features/editor/components/TimelineClip.tsx` (lines 78–94):
```typescript
const isAudioTrack = trackType === "audio" || trackType === "music";
const hasWaveform = isAudioTrack || trackType === "video";
const [waveformContainerEl, setWaveformContainerEl] = useState<HTMLDivElement | null>(null);
const onWaveformContainerRef = useCallback((el: HTMLDivElement | null) => {
  setWaveformContainerEl(el);
}, []);

useWaveform({
  audioUrl: hasWaveform ? (assetUrlMap.get(clip.assetId ?? "") ?? undefined) : undefined,
  container: waveformContainerEl,
  waveColor: color,
  height: 32,
});
```

The clip renders a `<div ref={onWaveformContainerRef} className="absolute inset-0 opacity-30 pointer-events-none" />` as the waveform mount target (lines 276–280).

### Root Causes of the Failure

**1. Cache keyed by URL, not assetId**
R2 signed URLs expire and rotate. When a URL changes for the same asset, the cache misses every time — `WaveSurfer.create()` is called again, fetching the full audio file on each page load or navigation. If the URL has already expired before WaveSurfer fetches it, decode fails silently.

**2. Missing cleanup for the cached path**
In `use-waveform.ts` (lines 50–58), the cache-hit branch calls `setOptions` and does an early `return` — it returns no cleanup function. When a clip unmounts (e.g., scrolled out of the timeline viewport), the WaveSurfer instance remains attached to the now-detached DOM node. On remount, `setOptions` with the new container may find the renderer in a corrupt state, producing a blank waveform silently.

**3. WaveSurfer renders into a Shadow DOM / canvas element**
WaveSurfer v7 renders into a `<shadow-root>` canvas. The clip container applies `overflow: hidden` (line 259 of `TimelineClip.tsx`). If WaveSurfer calculates its canvas dimensions before the container has non-zero layout dimensions (possible during first paint), it renders at 0×0 and never re-renders.

**4. WaveSurfer fetches video files for shot clips**
`hasWaveform` is true for `trackType === "video"`. Video `.mp4` files can be decoded by `decodeAudioData` in modern browsers, but WaveSurfer's internal fetch pipeline buffers the entire video file into memory before decode — this is unnecessarily heavy and can OOM-kill the tab on long clips.

**Why replace WaveSurfer entirely rather than patch it**
- The fix for bug #1 requires a two-level cache (assetId → peaks data); WaveSurfer caches rendered DOM, not PCM data. Adding a PCM-level cache on top of WaveSurfer doubles the code.
- The fix for bug #2 requires careful cleanup bookkeeping in a library whose internals are not fully controlled.
- The SVG-based replacement has zero runtime dependencies, is ~60 lines, fully typed, and gives complete control over visual styling.
- `wavesurfer.js` is ~120 kB gzipped; removing it reduces the bundle meaningfully.

---

## No Schema Changes

Waveform data is ephemeral, computed client-side, and stored only in memory. No database, no backend, no migration.

---

## Prerequisite: R2 CORS Configuration

`decodeAudioData` requires `fetch()` on the audio URL to succeed — cross-origin fetches need CORS headers on the R2 bucket. The existing WaveSurfer implementation has the same requirement. Confirm the R2 bucket (or CDN in front of it) returns:

```
Access-Control-Allow-Origin: https://app.domain.com
Access-Control-Allow-Methods: GET
```

This is an infra prerequisite. If CORS is not configured, `fetch()` will throw a network error which the hook handles gracefully (no waveform rendered, no crash).

---

## Implementation

### Build sequence

1. `use-waveform-data.ts` — decode hook (Web Audio API)
2. `WaveformBars.tsx` — pure SVG renderer
3. `TimelineClip.tsx` — wire up new hook + component, remove old hook
4. `use-waveform.ts` — delete
5. `package.json` — remove `wavesurfer.js`

---

### 1. `frontend/src/features/editor/hooks/use-waveform-data.ts` _(new file)_

Owns all decoding, caching, and request coalescing. Returns plain peak data — no DOM dependency.

```typescript
import { useState, useEffect } from "react";

/** Number of amplitude samples stored per asset. */
const PEAK_COUNT = 200;

/**
 * Module-level cache keyed by assetId (stable across signed URL rotations).
 * Stores RMS-normalized peak arrays decoded from audio/video files.
 */
const peakCache = new Map<string, Float32Array>();

/**
 * In-flight promise cache: prevents duplicate fetches when multiple clips for
 * the same asset mount simultaneously (e.g., a clip that spans two tracks).
 * Keyed by assetId.
 */
const pendingDecodes = new Map<string, Promise<Float32Array>>();

/**
 * Fetches an audio/video file by URL, decodes it with the Web Audio API,
 * and returns an RMS-normalized Float32Array of PEAK_COUNT amplitude samples.
 *
 * Works for:
 *  - Audio files: .mp3, .wav, .aac, .ogg (voiceover, music)
 *  - Video files: .mp4, .webm (shot clips — extracts the embedded audio track)
 *
 * Throws on network error, CORS error, or unsupported codec.
 */
async function decodePeaks(audioUrl: string): Promise<Float32Array> {
  const response = await fetch(audioUrl, {
    credentials: "omit",  // R2 signed URLs don't need credentials
    cache: "force-cache",  // reuse cached response if browser has it
  });

  if (!response.ok) {
    throw new Error(`waveform fetch failed: HTTP ${response.status} — ${audioUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // AudioContext is used only for decoding — not for playback.
  // Close immediately after decode to release resources.
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    // Non-blocking — do not await, fire and forget.
    ctx.close().catch(() => {});
  }

  // Use channel 0 (left/mono). Stereo files are fine — we only need one channel
  // to compute amplitude. The RMS across both channels would be more accurate,
  // but the visual difference is imperceptible for timeline thumbnails.
  const channelData = decoded.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / PEAK_COUNT));

  const peaks = new Float32Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += channelData[j] * channelData[j]; // squared for RMS
    }
    peaks[i] = Math.sqrt(sum / (end - start));
  }

  // Normalize to [0, 1]. If the file is entirely silent, leave as zeros.
  let max = 0;
  for (let i = 0; i < PEAK_COUNT; i++) {
    if (peaks[i] > max) max = peaks[i];
  }
  if (max > 0) {
    for (let i = 0; i < PEAK_COUNT; i++) peaks[i] /= max;
  }

  return peaks;
}

export interface UseWaveformDataResult {
  /** Normalized amplitude array [0,1] with PEAK_COUNT entries. Null while loading or on error. */
  peaks: Float32Array | null;
  /** True while the audio file is being fetched and decoded. */
  loading: boolean;
}

/**
 * Decodes waveform amplitude data for a single clip.
 *
 * - Cache hit (same assetId seen before): returns peaks synchronously on first render,
 *   loading=false. No network request.
 * - Cache miss: loading=true until decode completes, then peaks becomes non-null.
 * - Concurrent mounts with the same assetId share one in-flight promise.
 * - Component unmount cancels the state update but does not abort the fetch;
 *   the decode result is still stored in the cache for future mounts.
 *
 * @param assetId  Stable asset identifier (clip.assetId). Used as the cache key.
 * @param audioUrl Resolved URL to the audio/video file. Used only for fetching.
 */
export function useWaveformData(
  assetId: string | undefined,
  audioUrl: string | undefined
): UseWaveformDataResult {
  // Initialise from cache synchronously so clips that were decoded earlier in
  // this session render instantly without a loading flash.
  const [peaks, setPeaks] = useState<Float32Array | null>(() =>
    assetId ? (peakCache.get(assetId) ?? null) : null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !!assetId && !peakCache.has(assetId) && !!audioUrl
  );

  useEffect(() => {
    if (!assetId || !audioUrl) return;

    // Synchronous cache hit — state is already correct from initializer.
    if (peakCache.has(assetId)) {
      const cached = peakCache.get(assetId)!;
      setPeaks(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Coalesce: if another mount is already decoding this asset, attach to its promise.
    let promise = pendingDecodes.get(assetId);
    if (!promise) {
      promise = decodePeaks(audioUrl)
        .then((result) => {
          peakCache.set(assetId, result);
          pendingDecodes.delete(assetId);
          return result;
        })
        .catch((err) => {
          pendingDecodes.delete(assetId);
          // Re-throw so the .then handler below does not set peaks.
          throw err;
        });
      pendingDecodes.set(assetId, promise);
    }

    promise
      .then((result) => {
        if (!cancelled) {
          setPeaks(result);
          setLoading(false);
        }
      })
      .catch(() => {
        // Decode failed (CORS, codec, network error).
        // Render nothing — clip still shows its label and duration.
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, audioUrl]);

  return { peaks, loading };
}
```

---

### 2. `frontend/src/features/editor/components/WaveformBars.tsx` _(new file)_

Pure rendering component. Accepts decoded peak data and emits an SVG. No fetching, no state.

```tsx
interface Props {
  peaks: Float32Array | null;
  loading: boolean;
  color: string;
}

/**
 * Renders a bar-chart waveform inside a clip block.
 *
 * Geometry:
 *  - Fills the parent container via `absolute inset-0`.
 *  - Uses a normalised SVG viewBox (0 0 PEAK_COUNT 1) with preserveAspectRatio="none"
 *    so the waveform stretches to any clip width without recalculating bar coordinates.
 *  - Each bar is 0.8 units wide with a 0.2-unit gap, centred vertically.
 *  - Minimum bar height of 0.02 keeps silent sections visually present as a thin line.
 *
 * Loading state:
 *  - Shows a CSS pulse shimmer in the track colour while decoding.
 *  - The shimmer fills the same absolute inset-0 area so the clip label is still readable.
 */
export function WaveformBars({ peaks, loading, color }: Props) {
  if (loading) {
    return (
      <div
        className="absolute inset-0 animate-pulse pointer-events-none"
        style={{ backgroundColor: color + "22" }}
      />
    );
  }

  if (!peaks || peaks.length === 0) return null;

  const N = peaks.length;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${N} 1`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from(peaks).map((peak, i) => {
        const h = Math.max(peak, 0.02);
        return (
          <rect
            key={i}
            x={i}
            y={(1 - h) / 2}
            width={0.8}
            height={h}
            fill={color}
            opacity={0.45}
          />
        );
      })}
    </svg>
  );
}
```

**Why `viewBox="0 0 N 1" preserveAspectRatio="none"`**
The clip width in pixels is `(clip.durationMs / 1000) * zoom` — it changes every time the user zooms. Recalculating 200 bar x-coordinates on every zoom change would be expensive. With a normalised viewBox, the browser's SVG renderer handles the scaling for free. The `<svg>` element itself is `absolute inset-0 w-full h-full`, so it always fills the clip block exactly.

**Why 0.8-unit bar width**
The 0.2-unit gap between bars is visible at typical clip widths (200–600px for a 5–15s clip at default zoom) but disappears at narrow clips — the SVG simply squashes all bars together into a solid fill, which is the correct degenerate visual.

**Minimum height 0.02**
Prevents bars from being invisible in silent sections. A 0.02-unit bar at the centre of the clip is 2% of the clip height — just enough to confirm the waveform was computed without being mistaken for actual signal.

---

### 3. `frontend/src/features/editor/components/TimelineClip.tsx` _(modified)_

#### 3a. Update imports

```typescript
// Remove:
import { useWaveform } from "../hooks/use-waveform";

// Add:
import { useWaveformData } from "../hooks/use-waveform-data";
import { WaveformBars } from "./WaveformBars";
```

Remove `useState` from the React import (it was only used for `waveformContainerEl`). Keep `useRef`, `useCallback`.

```typescript
// Before (line 1):
import { useRef, useState, useCallback } from "react";

// After:
import { useRef, useCallback } from "react";
```

#### 3b. Replace waveform state + hook (lines 80–94)

```typescript
// Remove entirely:
const [waveformContainerEl, setWaveformContainerEl] =
  useState<HTMLDivElement | null>(null);
const onWaveformContainerRef = useCallback((el: HTMLDivElement | null) => {
  setWaveformContainerEl(el);
}, []);

useWaveform({
  audioUrl: hasWaveform
    ? (assetUrlMap.get(clip.assetId ?? "") ?? undefined)
    : undefined,
  container: waveformContainerEl,
  waveColor: color,
  height: 32,
});

// Replace with:
const waveformUrl = hasWaveform
  ? (assetUrlMap.get(clip.assetId ?? "") ?? undefined)
  : undefined;
const { peaks, loading: waveformLoading } = useWaveformData(
  hasWaveform ? (clip.assetId ?? undefined) : undefined,
  waveformUrl
);
```

#### 3c. Replace waveform render (lines 276–298)

```tsx
// Remove:
{hasWaveform ? (
  <div
    ref={onWaveformContainerRef}
    className="absolute inset-0 opacity-30 pointer-events-none"
  />
) : (
  <svg
    className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
    preserveAspectRatio="none"
  >
    {Array.from({ length: 4 }).map((_, i) => (
      <line
        key={i}
        x1={0}
        y1={8 + i * 9}
        x2={width}
        y2={8 + i * 9}
        stroke={color}
        strokeDasharray="4 4"
      />
    ))}
  </svg>
)}

// Replace with:
{hasWaveform ? (
  <WaveformBars peaks={peaks} loading={waveformLoading} color={color} />
) : (
  <svg
    className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
    preserveAspectRatio="none"
  >
    {Array.from({ length: 4 }).map((_, i) => (
      <line
        key={i}
        x1={0}
        y1={8 + i * 9}
        x2={width}
        y2={8 + i * 9}
        stroke={color}
        strokeDasharray="4 4"
      />
    ))}
  </svg>
)}
```

The non-audio SVG fallback (dashed horizontal lines for text clips) is **unchanged**.

---

### 4. `frontend/src/features/editor/hooks/use-waveform.ts` _(delete)_

Delete the file entirely. No other file imports it after step 3.

---

### 5. `frontend/package.json` _(modified)_

Remove `wavesurfer.js` from `dependencies`:

```json
// Remove this line from dependencies:
"wavesurfer.js": "^7.12.4"
```

Run `bun install` after removing to clean the lockfile.

---

## Data Flow

```mermaid
sequenceDiagram
  participant TimelineClip
  participant useWaveformData
  participant peakCache (module)
  participant pendingDecodes (module)
  participant fetch + AudioContext

  TimelineClip->>useWaveformData: assetId="abc", audioUrl="https://r2.../abc.mp3"

  alt Cache hit (same asset seen this session)
    useWaveformData-->>TimelineClip: { peaks: Float32Array, loading: false }
    TimelineClip->>WaveformBars: render bars immediately
  else Cache miss
    useWaveformData-->>TimelineClip: { peaks: null, loading: true }
    TimelineClip->>WaveformBars: render shimmer
    useWaveformData->>pendingDecodes: create promise for "abc"
    useWaveformData->>fetch + AudioContext: GET audioUrl → decodeAudioData → RMS downsample
    fetch + AudioContext-->>useWaveformData: Float32Array(200)
    useWaveformData->>peakCache: set("abc", peaks)
    useWaveformData-->>TimelineClip: { peaks: Float32Array, loading: false }
    TimelineClip->>WaveformBars: render bars
  end

  note over TimelineClip: Zoom change (width changes)
  TimelineClip->>WaveformBars: same peaks, SVG re-scales via viewBox
```

---

## Clip Type Coverage

| Track type | `hasWaveform` | Audio source | Expected result |
|---|---|---|---|
| `"audio"` (voiceover) | `true` | `.mp3` / `.aac` audio file | Peaks decoded from audio PCM data |
| `"music"` | `true` | `.mp3` / `.aac` audio file | Peaks decoded from audio PCM data |
| `"video"` (shot clips) | `true` | `.mp4` video file | `decodeAudioData` extracts embedded audio track; peaks from that |
| `"video"` (silent clip) | `true` | `.mp4` with no audio track | `decodeAudioData` may throw or return silence → `peaks: null`, no waveform rendered |
| `"text"` (captions) | `false` | — | SVG dashed-lines fallback, unchanged |

---

## Caching Behaviour

| Scenario | Behaviour |
|---|---|
| Same asset mounted multiple times (e.g., duplicated clip) | One fetch, one decode, shared `Float32Array` from `peakCache` |
| Clip unmounts, remounts (timeline scrolled off and back) | Instant render from `peakCache` — no refetch |
| Signed URL rotates (R2 URL refreshed by backend) | `assetId` is stable; `peakCache` hit returns existing peaks — new URL never fetched |
| Two clips with same `assetId` mount simultaneously | `pendingDecodes` coalesces to one in-flight promise; both receive the result |
| 100 unique assets open in one session | All 100 `Float32Array(200)` entries live in memory: 100 × 800 bytes = ~78 KB. Negligible. |
| Browser tab refresh | Cache is cleared (module-level, not persisted). First load after refresh re-decodes. Acceptable for MVP; IndexedDB persistence is a future optimisation. |
| Decode fails (CORS, expired URL, unsupported codec) | `peaks: null`, `loading: false` — clip renders with no waveform but no crash |

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Clip `assetId` is `null` (text clips) | `hasWaveform = false`; `useWaveformData` receives `undefined` for both args; returns `{ peaks: null, loading: false }` immediately; `WaveformBars` is not rendered |
| Very narrow clip (≤4px wide at current zoom) | `WaveformBars` SVG fills the 4px container; `preserveAspectRatio="none"` squashes 200 bars into a solid fill. Correct visual — indistinguishable from a solid block at that scale |
| `audioUrl` resolves before container mounts | Not applicable — `useWaveformData` has no DOM dependency. Decode starts as soon as `assetId` and `audioUrl` are non-null, regardless of render state |
| Timeline unmounted mid-decode (user navigates away) | `cancelled = true` prevents `setPeaks`/`setLoading` state updates; the decode promise still completes and the result is stored in `peakCache`. The cancelled flag prevents the React warning about state updates on unmounted components |
| `AudioContext` suspended by browser (autoplay policy) | `decodeAudioData` does not trigger audio output and works on suspended `AudioContext`. No user gesture needed |
| Safari < 16 | `AudioContext.decodeAudioData` is fully supported. `webkitAudioContext` prefix not required for Safari 14.1+. No polyfill needed |
| Very long file (>30 min music track) | `fetch` + `decodeAudioData` on a 30-min .mp3 (~50 MB) will use ~400 MB of RAM during decode. Acceptable for desktop; music clips in this editor are expected to be short. Add a file size guard (`Content-Length` header check before decode) in a follow-up if needed |
| User zooms timeline while decode in progress | `WaveformBars` renders shimmer until decode completes. After decode, `peaks` state updates and all clip instances re-render with bars. The SVG scales to the new zoom via `viewBox` — no re-decode needed |

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/features/editor/hooks/use-waveform-data.ts` | **New** — Web Audio API decode hook with LRU cache and request coalescing |
| `frontend/src/features/editor/components/WaveformBars.tsx` | **New** — SVG bar-chart renderer with loading shimmer |
| `frontend/src/features/editor/components/TimelineClip.tsx` | **Modified** — swap `useWaveform` → `useWaveformData`, swap container div → `<WaveformBars>`, remove `useState` import |
| `frontend/src/features/editor/hooks/use-waveform.ts` | **Deleted** |
| `frontend/package.json` | **Modified** — remove `wavesurfer.js` dependency |

No backend changes. No database migration. No new i18n keys.
