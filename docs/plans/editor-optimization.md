# Editor Optimization Plan

> Comprehensive plan to fix video preview lag, clip overlap bugs, enable FPS/metadata control, and make the editor production-performant.

---

## Phase 0: Fix Clip Overlap / Stacking Bug (CRITICAL — Do First)

### Root Cause Analysis

Clips stack on top of each other because **overlap prevention is inconsistent across entry points**. Some paths enforce non-overlap, but most don't. Here's every way a clip can end up overlapping another on the same track:

#### Entry Points With NO Overlap Protection

| # | Entry Point | File | Line | What Happens |
|---|------------|------|------|--------------|
| 1 | `ADD_CLIP` | `editor-reducer-clip-ops.ts:33` | Appends clip to track with zero collision check. Whatever `startMs` is passed goes straight in. |
| 2 | `ADD_CAPTION_CLIP` | `editor-reducer-clip-ops.ts:49` | Same — raw append, no collision check. |
| 3 | `UPDATE_CLIP` (startMs change) | `editor-reducer-clip-ops.ts:147` | `updateClipInTracks` applies the patch blindly. If the patch includes `startMs` or `durationMs`, no overlap validation runs. |
| 4 | `MOVE_CLIP` | `editor-reducer-clip-ops.ts:359` | Calls `updateClipInTracks` with raw `startMs` — **no `clampMoveToFreeSpace`**. The UI's `TimelineClip.handleDragStart` calls `clampMoveToFreeSpace` before dispatching, but the reducer itself is unguarded. Any other caller (keyboard move, programmatic move, server merge) can create overlaps. |
| 5 | `DUPLICATE_CLIP` | `editor-reducer-clip-ops.ts:332` | Places copy at `trackEnd` (max clip endMs), but doesn't check if that position actually collides with clips on other parts of the track. With non-contiguous clips this can overlap. |
| 6 | `SPLIT_CLIP` | `editor-reducer-clip-ops.ts:304` | `splitClip()` creates two clips from one — the math should be safe, but there's no post-split collision assertion. |
| 7 | `MERGE_TRACKS_FROM_SERVER` | `editor-reducer-track-ops.ts:143` | Merges server clips + locally modified clips with zero overlap check. If server and local both have clips in the same time range, they stack. |
| 8 | `REORDER_SHOTS` | `editor-reducer-track-ops.ts:87` | Uses a cursor to lay clips sequentially — this one is actually safe. |
| 9 | Backend `mergeTrackSets` | `sync/sync.service.ts:352` | Concatenates `[...mergedContentClips, ...userClips]` — user clips keep their original `startMs` which can overlap content clips that were just re-laid. |
| 10 | Backend `reconcileVideoClipsWithoutPlaceholders` | `merge-placeholders-with-assets.ts:71` | Uses `preservedStartMs` from existing clips, which can overlap newly added clips if assets were reordered. |
| 11 | Backend `mergePlaceholdersWithRealClips` (audio/music) | `merge-placeholders-with-assets.ts:226` | Concatenates `[...nonVoiceoverClips, voiceoverClip]` — if the user added a clip at startMs:0 and the voiceover also starts at 0, they overlap. |

#### Entry Points That DO Check (but incompletely)

| # | Entry Point | File | What It Does |
|---|------------|------|--------------|
| A | `PASTE_CLIP` | `editor-reducer-clip-ops.ts:269` | Calls `clampMoveToFreeSpace` — but only for media clips. Text and caption pastes get no check. |
| B | `ADD_CLIP_AUTO_PROMOTE` | `editor-reducer-clip-ops.ts:84` | Uses `hasCollision` to find a free track — good for video. But if all tracks collide, creates a new track (correct). However, does not clamp timing on the target track. |
| C | `TimelineClip` drag handler | `TimelineClip.tsx:117` | Calls `clampMoveToFreeSpace` on mouseup — UI-only guard. Bypassed by any non-drag path. |
| D | `TimelineClip` trim handlers | `TimelineClip.tsx:163,205` | Calls `clampTrimStart`/`clampTrimEnd` — UI-only. The reducer doesn't re-validate. |

### The Fix: Defense in Depth (3 Layers)

The principle: **no single layer should be trusted**. Every layer independently prevents overlaps.

---

### 0.1 Layer 1 — Reducer-Level Enforcement (Frontend)

**Every reducer action that modifies clip position or timing must validate non-overlap before committing.**

```
Files to modify:
- frontend/src/features/editor/utils/clip-constraints.ts (add enforceNoOverlap)
- frontend/src/features/editor/model/editor-reducer-helpers.ts (add sanitizeTracksNoOverlap)
- frontend/src/features/editor/model/editor-reducer-clip-ops.ts (guard every action)
- frontend/src/features/editor/model/editor-reducer-track-ops.ts (guard MERGE_TRACKS_FROM_SERVER)
```

**Approach:**

**A) Add `enforceNoOverlap(track, clipId, startMs, durationMs)` to `clip-constraints.ts`:**
- If the proposed position overlaps another clip, auto-resolve by calling `clampMoveToFreeSpace`
- Returns the safe `startMs`
- This is the single function that ALL paths call

**B) Add `sanitizeTracksNoOverlap(tracks)` to `editor-reducer-helpers.ts`:**
- Scans every track for overlapping clips
- For any overlap found, resolves by pushing the later clip rightward (sequential re-layout)
- Called as a final pass after ANY reducer action that modifies clips
- This is the **catch-all safety net** — even if individual actions miss an edge case, the final sanitization fixes it

**C) Guard each reducer action:**

- `ADD_CLIP`: Before appending, run `enforceNoOverlap` on the new clip's startMs. If collision, auto-adjust startMs.
- `ADD_CAPTION_CLIP`: Same treatment — enforce no overlap on text track.
- `UPDATE_CLIP`: If patch contains `startMs` or `durationMs`, run `enforceNoOverlap` on the updated values.
- `MOVE_CLIP`: Replace raw `updateClipInTracks` with `enforceNoOverlap` + update. The reducer should not trust the caller.
- `DUPLICATE_CLIP`: After computing `trackEnd`, verify with `enforceNoOverlap`.
- `PASTE_CLIP`: Extend existing `clampMoveToFreeSpace` to ALL clip types (not just media).
- `MERGE_TRACKS_FROM_SERVER`: After merging, run `sanitizeTracksNoOverlap` on the result.

**D) Final sanitization pass:**
Every reducer return path that includes modified tracks should run through `sanitizeTracksNoOverlap` before returning. This is a single line added to `pushPastTracks` or a wrapper:

```typescript
// In editor-reducer-helpers.ts
export function pushPastTracks(state: EditorState, newTracks: Track[]): Pick<EditorState, "past" | "future" | "tracks"> {
  return {
    past: [...state.past, snapshotEditorState(state)].slice(-50),
    future: [],
    tracks: sanitizeTracksNoOverlap(newTracks),  // <-- NEW: always clean
  };
}
```

This single change covers almost every action because they all flow through `pushPastTracks`.

---

### 0.2 Layer 2 — Backend Validation (Server)

**The backend should reject or auto-fix overlapping clips on save.**

```
Files to modify:
- backend/src/domain/editor/editor.schemas.ts (add track-level overlap refinement)
- backend/src/domain/editor/editor.service.ts (add sanitization before write)
- backend/src/domain/editor/sync/sync.service.ts (sanitize after merge)
- backend/src/domain/editor/timeline/merge-placeholders-with-assets.ts (sanitize after reconcile)
```

**Approach:**

**A) Add Zod refinement to `editorTrackDataSchema`:**

```typescript
export const editorTrackDataSchema = z.object({
  // ... existing fields
}).superRefine((track, ctx) => {
  const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.startMs + prev.durationMs > curr.startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Clip "${curr.id}" overlaps with "${prev.id}" on track "${track.id}"`,
        path: ["clips", i],
      });
    }
  }
});
```

This makes overlapping clips a **schema validation error**. The autosave PATCH will be rejected with 422 if the frontend sends overlapping data. This is the hard backstop.

**B) Add `sanitizeTrackOverlaps()` utility for server-side auto-fix:**

Used by `SyncService.mergeTrackSets` and `mergePlaceholdersWithRealClips` — these are server-initiated mutations where we should fix rather than reject. Sorts clips by startMs, pushes overlapping clips rightward.

**C) Fix `mergeTrackSets` specifically:**

The `[...mergedContentClips, ...userClips]` concatenation must re-lay user clips to avoid overlap:

```typescript
// After merging
const allClips = [...mergedContentClips, ...userClips];
const sanitized = resolveOverlapsSequential(allClips);
return { ...track, clips: sanitized };
```

**D) Fix `reconcileVideoClipsWithoutPlaceholders`:**

The `preservedStartMs` logic preserves the old position even when new clips have been inserted before it. After building all clips, run a final overlap pass.

**E) Fix audio/music merge in `mergePlaceholdersWithRealClips`:**

`[...nonVoiceoverClips, voiceoverClip]` and `[...nonMusicClips, musicClip]` need overlap resolution when user clips exist at startMs:0.

---

### 0.3 Layer 3 — Runtime Self-Healing (Frontend)

**The editor should detect and fix overlaps on load, even if they were persisted to the DB.**

```
Files to modify:
- frontend/src/features/editor/model/editor-reducer-session-ops.ts (LOAD_PROJECT)
```

**Approach:**

In the `LOAD_PROJECT` handler, after `alignTracksTrimInvariant(rawTracks)`, add:

```typescript
const tracks = sanitizeTracksNoOverlap(alignTracksTrimInvariant(rawTracks));
```

If any clips were adjusted, the first autosave will persist the fixed state. This heals any existing bad data in the DB without requiring a migration.

---

### 0.4 `clampMoveToFreeSpace` Bug Fix

The current implementation has a subtle bug: its resolution loop can produce a position that still overlaps if the snap lands inside a third clip. The loop runs `others.length` iterations, but each iteration only resolves one collision and may create another.

```
File: frontend/src/features/editor/utils/clip-constraints.ts
```

**Fix:** Sort others by startMs first, then do a single sequential pass:

```typescript
export function clampMoveToFreeSpace(
  track: Track,
  movingClipId: string,
  proposedStartMs: number,
  durationMs: number
): number {
  const others = track.clips
    .filter((c) => c.id !== movingClipId)
    .sort((a, b) => a.startMs - b.startMs);

  let start = Math.max(0, proposedStartMs);

  // Find the best non-overlapping position
  // Strategy: try proposed position, snap to nearest gap if collision
  for (let attempt = 0; attempt < others.length + 1; attempt++) {
    const collision = others.find(
      (other) => start < other.startMs + other.durationMs && start + durationMs > other.startMs
    );
    if (!collision) return start;

    const snapBefore = Math.max(0, collision.startMs - durationMs);
    const snapAfter = collision.startMs + collision.durationMs;
    const distBefore = Math.abs(proposedStartMs - snapBefore);
    const distAfter = Math.abs(proposedStartMs - snapAfter);

    // Check if snapBefore is actually free
    const beforeFree = !others.some(
      (o) => snapBefore < o.startMs + o.durationMs && snapBefore + durationMs > o.startMs
    );

    if (beforeFree && distBefore <= distAfter) {
      start = snapBefore;
    } else {
      start = snapAfter;
    }
  }

  return start;
}
```

---

### 0.5 Implementation Sequence

1. **Add `sanitizeTracksNoOverlap`** — the shared utility. Write unit tests proving it resolves all overlap scenarios.
2. **Wire it into `pushPastTracks`** — single integration point covers ~90% of reducer actions.
3. **Wire it into `LOAD_PROJECT`** — self-heal on load.
4. **Wire it into `MERGE_TRACKS_FROM_SERVER`** — fix server merge overlaps.
5. **Fix `clampMoveToFreeSpace`** — the snap-back bug.
6. **Add Zod refinement on backend** — hard validation backstop.
7. **Fix `mergeTrackSets` user clip append** — re-lay after concat.
8. **Fix `mergePlaceholdersWithRealClips` audio/music** — resolve after concat.
9. **Add `sanitizeTrackOverlaps` server-side** — shared utility for backend merge paths.

### Test Cases

These must all pass before this is considered done:

```
- Two clips at same startMs on same track → second clip pushed right
- Clip moved onto another clip via UPDATE_CLIP → auto-resolved
- Clip pasted onto occupied region (all clip types) → snapped to free space
- Server merge with conflicting local/server clips → resolved
- SyncService mergeTrackSets with user clip at content clip position → user clip pushed right
- Placeholder resolution places real clip overlapping user clip → resolved
- Audio track with voiceover at 0ms and user clip at 0ms → resolved
- DUPLICATE_CLIP on non-contiguous track → placed in actual free space
- LOAD_PROJECT with pre-existing overlapping clips in DB → fixed on load
- Rapid ADD_CLIP calls (e.g., bulk import) → all clips sequentialized
- Undo after overlap fix → restores to pre-fix state (overlap comes back, next action re-fixes)
```

---

## Current State Assessment

### Architecture Summary
- **Preview**: `PreviewArea.tsx` renders `<video>` elements per clip, synced to a `requestAnimationFrame`-driven playhead (`usePlayback.ts`)
- **State**: `useReducer` in `useEditorStore.ts` with undo/redo history snapshots. All state flows through React context (`EditorContext`)
- **Timeline**: `Timeline.tsx` + `TimelineClip.tsx` — DOM-based drag/trim with manual `mousemove` listeners
- **Autosave**: 500ms debounce + 30s heartbeat interval via `useEditorAutosave`
- **Export**: Server-side FFmpeg pipeline (`run-export-job.ts`) downloads assets to tmp, builds filter_complex, encodes

### Root Cause Analysis: Video Preview Lag

The "weird lag" when working with videos in the preview has multiple contributing factors:

1. **Every rAF tick dispatches a reducer action** (`SET_CURRENT_TIME`) which creates a new state object, causing the entire editor tree to re-render — including the Timeline, Inspector, and all clips
2. **`buildActiveVideoClipIdsByTrackMap` runs twice per frame** — once in the `useMemo` (line 94) and again in the sync `useEffect` (line 148) inside `PreviewArea.tsx`
3. **No video element reuse** — when clips change order or tracks re-render, `<video>` elements lose their ref and get recreated, causing re-buffering
4. **Heavy preload window is 45 seconds** (`PRELOAD_WINDOW_MS`), meaning many clips get `preload="auto"` simultaneously, competing for bandwidth and decode threads
5. **Caption canvas redraws every frame** even when no caption is active, running the full `renderFrame` pipeline
6. **Waveform decode creates a new `AudioContext` per asset** and does not limit concurrency — multiple simultaneous decodes thrash the audio thread
7. **Timeline clips are not memoized** — every `TimelineClip` re-renders on any state change because the parent `Timeline` gets a new `state` object every frame during playback

---

## Phase 1: Fix Video Preview Lag (Critical)

### 1.1 Decouple Playhead Time from React State

**Problem**: `SET_CURRENT_TIME` dispatches ~60x/sec during playback, causing full tree re-renders.

**Solution**: Store `currentTimeMs` in a `useRef` + separate `useSyncExternalStore` subscriber pattern. Only components that read `currentTimeMs` re-render.

```
Files to modify:
- frontend/src/features/editor/hooks/useEditorStore.ts
- frontend/src/features/editor/hooks/usePlayback.ts
- frontend/src/features/editor/context/EditorContext.tsx
- frontend/src/features/editor/components/PreviewArea.tsx
- frontend/src/features/editor/components/Playhead.tsx
- frontend/src/features/editor/components/TimelineRuler.tsx
```

**Approach**:
- Create a `TimeStore` class with `currentTimeMs` as a ref-backed value with subscriber pattern
- `usePlayback` writes directly to `TimeStore` ref — no dispatch
- `PreviewArea` subscribes to `TimeStore` for sync — no reducer involvement during playback
- `Playhead` component reads from `TimeStore` via `useSyncExternalStore`
- The reducer `SET_CURRENT_TIME` is only used for manual seeks (click, keyboard, scrub)

**Impact**: Eliminates ~60 full-tree renders/sec during playback. This is the single biggest win.

### 1.2 Deduplicate Active Clip Computation in PreviewArea

**Problem**: `buildActiveVideoClipIdsByTrackMap` is called in both the `useMemo` (line 94) and the video sync `useEffect` (line 148).

**Solution**: Remove the duplicate call in the `useEffect` — use the memoized `activeVideoClipIdsByTrack` result directly.

```
Files to modify:
- frontend/src/features/editor/components/PreviewArea.tsx
```

**Approach**: The `useEffect` at line 147 should reference `activeVideoClipIdsByTrack` from the `useMemo` instead of recomputing. This also means adding `activeVideoClipIdsByTrack` to the effect deps.

### 1.3 Move Video/Audio Sync to Imperative Refs (No useEffect)

**Problem**: Video sync happens in a `useEffect` that depends on `currentTimeMs`, meaning it runs after React commits — adding one frame of latency and risking stale closures during rapid seeking.

**Solution**: Use a single `requestAnimationFrame` callback (from `usePlayback`) that calls an imperative sync function directly, bypassing React's effect scheduling.

```
Files to modify:
- frontend/src/features/editor/hooks/usePlayback.ts
- frontend/src/features/editor/components/PreviewArea.tsx
```

**Approach**:
- `usePlayback` accepts an optional `onFrame(timeMs)` callback that fires inside the rAF loop
- `PreviewArea` passes a stable ref-based sync function as `onFrame`
- The sync function reads `videoRefs` and `audioRefs` directly — no React state involved
- Remove the two `useEffect` blocks for video/audio sync (lines 147-239)

### 1.4 Reduce Preload Window

**Problem**: `PRELOAD_WINDOW_MS = 45_000` (45 seconds) causes too many clips to have `preload="auto"`, competing for decode bandwidth.

**Solution**: Reduce to 10-15 seconds. Add a priority system: active clips and next-up clips get `preload="auto"`, everything else gets `"none"`.

```
Files to modify:
- frontend/src/features/editor/utils/editor-composition.ts
```

---

## Phase 2: Memoize Timeline & Clip Rendering

### 2.1 Memoize TimelineClip

**Problem**: Every `TimelineClip` re-renders when any state property changes (zoom, selectedClipId, currentTimeMs).

**Solution**: Wrap `TimelineClip` in `React.memo` with a custom comparator. Only re-render when the clip's own data, selection state, or zoom changes.

```
Files to modify:
- frontend/src/features/editor/components/TimelineClip.tsx
- frontend/src/features/editor/components/Timeline.tsx
```

**Approach**:
- `React.memo(TimelineClip, (prev, next) => ...)` comparing: `clip`, `isSelected`, `zoom`, `isLocked`, `playheadMs` range (only if clip is in range)
- Stabilize callback props using `useCallback` with clip ID in the parent, or pass clip ID and let the child call a stable dispatch

### 2.2 Virtualize Timeline Clips

**Problem**: All clips render DOM elements even when scrolled out of view. With many clips this becomes expensive.

**Solution**: Only render clips whose pixel range overlaps the visible scroll window.

```
Files to modify:
- frontend/src/features/editor/components/Timeline.tsx
```

**Approach**:
- Calculate visible time range from `scrollRef.scrollLeft` and `scrollRef.clientWidth`
- Filter clips to those whose `[startMs, startMs + durationMs]` overlaps the visible range
- Re-filter on scroll events (throttled)

### 2.3 Stabilize Track/Clip References

**Problem**: `tracks.filter(...)` in PreviewArea and Timeline creates new arrays every render, breaking memoization downstream.

**Solution**: Memoize filtered track arrays.

```
Files to modify:
- frontend/src/features/editor/components/PreviewArea.tsx
- frontend/src/features/editor/components/Timeline.tsx
```

---

## Phase 3: FPS & Metadata Controls

### 3.1 Expose FPS Control in Editor UI

**Problem**: FPS is stored in state (`fps: 30`) and passed to FFmpeg on export, but there's no UI to change it. The user cannot adjust FPS.

**Solution**: Add FPS picker to the editor toolbar or export modal.

```
Files to create/modify:
- frontend/src/features/editor/components/EditorToolbar.tsx (add FPS dropdown)
- frontend/src/features/editor/hooks/useEditorStore.ts (add SET_FPS action)
- frontend/src/features/editor/model/editor-reducer-session-ops.ts (handle SET_FPS)
- frontend/src/features/editor/types/editor.ts (add SET_FPS to EditorAction)
- frontend/src/features/editor/services/editor-api.ts (include fps in autosave patch)
```

**Approach**:
- Add `SET_FPS` action to reducer (with undo support)
- Add FPS selector (24, 25, 30, 60) next to the existing resolution picker
- Include `fps` in autosave PATCH payload
- Preview rAF loop does not need FPS gating — browsers handle this naturally

### 3.2 Expose Resolution Control for Preview vs Export

**Problem**: Resolution picker exists but only affects the composition canvas and export. Preview always renders at screen resolution.

**Solution**: This is already correct behavior — preview should match screen pixels for performance. Ensure the resolution picker clearly communicates it controls export resolution.

### 3.3 Per-Clip Speed Controls in Inspector

**Problem**: Speed is modifiable via context menu but there's no fine-grained inspector control.

**Solution**: Add a speed slider/input to `InspectorClipMetaPanel.tsx`.

```
Files to modify:
- frontend/src/features/editor/components/inspector/InspectorClipMetaPanel.tsx
```

### 3.4 Expose Video Metadata in Inspector

**Problem**: Users can't see source video metadata (codec, resolution, bitrate, actual duration).

**Solution**: Show read-only metadata panel when a video clip is selected.

```
Files to create/modify:
- frontend/src/features/editor/components/inspector/InspectorClipMetaPanel.tsx
- backend/src/domain/editor/editor.service.ts (optional: extract metadata via ffprobe on upload)
```

**Approach**:
- On asset upload, run `ffprobe` to extract metadata (codec, resolution, fps, bitrate, duration)
- Store in the asset's `metadata` JSON column
- Frontend reads from asset map and displays in inspector

---

## Phase 4: Export Pipeline Optimization

### 4.1 Stream Assets Instead of Full Download to Tmp

**Problem**: `run-export-job.ts` downloads every asset fully to `/tmp` before starting FFmpeg. For large projects this is slow and disk-heavy.

**Solution**: Use FFmpeg's HTTP input support with signed URLs where possible.

```
Files to modify:
- backend/src/domain/editor/run-export-job.ts
```

**Approach**:
- Generate long-lived signed URLs (1 hour) for each asset
- Pass signed URLs directly as FFmpeg inputs: `-i "https://...signed-url"`
- FFmpeg handles streaming/seeking natively for most formats
- Fall back to tmp download only for assets that need local processing (e.g., subtitle burn-in)

### 4.2 Hardware-Accelerated Encoding

**Problem**: Export uses `libx264` with `-preset fast`, which is CPU-bound.

**Solution**: Detect available hardware encoders and prefer them.

```
Files to modify:
- backend/src/domain/editor/run-export-job.ts
```

**Approach**:
- Check for `h264_videotoolbox` (macOS), `h264_nvenc` (NVIDIA), `h264_vaapi` (Linux)
- Fall back to `libx264` if none available
- For cloud deployment, use instances with GPU or configure for the specific encoder available

### 4.3 Progress Reporting via FFmpeg Stderr

**Problem**: Export progress jumps from 55% to 85% with no granularity during the actual encode.

**Solution**: Parse FFmpeg stderr output for frame/time progress.

```
Files to modify:
- backend/src/domain/editor/run-export-job.ts
```

**Approach**:
- Read `proc.stderr` as a stream during encoding
- Parse `time=HH:MM:SS.ms` from FFmpeg output
- Map to 55-85% range based on total duration
- Update job progress in DB at regular intervals

### 4.4 Caption Doc Query Deduplication

**Problem**: Caption docs and presets are fetched twice in `runExportJob` — once for validation (line 177-192) and again for rendering (line 317-326).

**Solution**: Fetch once and cache in a local map.

```
Files to modify:
- backend/src/domain/editor/run-export-job.ts
```

---

## Phase 5: Memory & Resource Management

### 5.1 Limit Concurrent Waveform Decodes

**Problem**: `useWaveformData` creates a new `AudioContext` per decode with no concurrency limit.

**Solution**: Add a decode queue with max concurrency of 2-3.

```
Files to modify:
- frontend/src/features/editor/hooks/useWaveformData.ts
```

**Approach**:
- Create a simple async semaphore/queue
- Limit to 2 concurrent `AudioContext` decodes
- Reuse a single `AudioContext` instance (close after all decodes complete, not per-decode)

### 5.2 Prune Video Elements for Far-Away Clips

**Problem**: Every video clip in every track gets a `<video>` element, even if 5 minutes away from playhead.

**Solution**: Only mount `<video>` elements within a reasonable window (e.g., 30 seconds of playhead).

```
Files to modify:
- frontend/src/features/editor/components/PreviewArea.tsx
```

**Approach**:
- For clips outside the window, render nothing (no DOM element)
- Inside the window but not active: render with `preload="metadata"`
- Active or about to be active: render with `preload="auto"`
- Use the existing `videoClipNeedsHeavyPreload` logic but tighten the window

### 5.3 Caption Canvas Optimization

**Problem**: Caption canvas runs full render pipeline every frame even when no caption is visible.

**Solution**: Early-return when no active caption doc exists.

```
Files to modify:
- frontend/src/features/editor/caption/hooks/useCaptionCanvas.ts
```

**Approach**:
- If `activeCaptionDoc` is null, skip canvas clear/draw entirely
- Cache the last rendered page hash — only redraw when the visible page changes, not every frame
- Use `OffscreenCanvas` for the heavy text rendering if available, compositing to main canvas

### 5.4 Undo History Memory

**Problem**: Undo snapshots store full track arrays (50 deep), each containing all clips across all tracks. For complex timelines this is significant memory.

**Solution**: Switch to operation-based undo (store the action + inverse) instead of full snapshots.

```
Files to modify:
- frontend/src/features/editor/model/editor-reducer-helpers.ts
- frontend/src/features/editor/model/editor-reducer-session-ops.ts
- frontend/src/features/editor/model/editor-reducer-clip-ops.ts
- frontend/src/features/editor/model/editor-reducer-track-ops.ts
```

**Note**: This is a larger refactor. A simpler intermediate step: use structural sharing (immer or manual) so unchanged tracks/clips share references with previous snapshots.

---

## Phase 6: Production Hardening

### 6.1 Error Boundaries for Preview & Timeline

**Problem**: A crash in the preview (e.g., bad video src, canvas error) takes down the entire editor.

**Solution**: Wrap PreviewArea and Timeline in React error boundaries with recovery UI.

```
Files to create/modify:
- frontend/src/features/editor/components/PreviewArea.tsx (wrap)
- frontend/src/features/editor/components/Timeline.tsx (wrap)
- frontend/src/features/editor/components/EditorErrorBoundary.tsx (new)
```

### 6.2 Web Worker for Waveform Decoding

**Problem**: Audio decoding blocks the main thread, causing jank during initial editor load.

**Solution**: Move `decodePeaksFromArrayBuffer` to a Web Worker.

```
Files to create/modify:
- frontend/src/features/editor/workers/waveform-worker.ts (new)
- frontend/src/features/editor/hooks/useWaveformData.ts (use worker)
```

### 6.3 Autosave Conflict Detection

**Problem**: The 30-second heartbeat save fires unconditionally even when nothing changed, wasting bandwidth and creating unnecessary DB writes.

**Solution**: Track a content hash and skip the heartbeat save if nothing changed since last save.

```
Files to modify:
- frontend/src/features/editor/hooks/useEditorAutosave.ts
```

---

## Phase 7: Code Structure & Simplification

### Review Summary

The editor works but has accumulated structural complexity that makes bugs like the overlap issue inevitable. The core problems are: too many indirection layers, split responsibilities, and data flowing through unnecessary hops. Here's what should be overhauled.

---

### 7.1 Collapse the God-Hook `useEditorLayoutRuntime`

**Problem**: `useEditorLayoutRuntime` (150 lines) exists solely to wire together 8 other hooks and return a flat bag of ~40 values. `EditorLayout` then manually destructures and passes these as individual props through `EditorToolbar` (25 props), `EditorWorkspace` (16 props), `EditorTimelineSection` (14 props), and `EditorDialogs` (12 props).

This creates a **prop drilling waterfall** where every component receives explicit props that were already available in context. `EditorWorkspace` receives `tracks`, `currentTimeMs`, `isPlaying`, etc. — all of which are already in `EditorContext`. The workspace then passes them to `PreviewArea` as props, even though PreviewArea could read context directly.

**Fix:**

- **Delete `useEditorLayoutRuntime`**. Move each concern to the component that owns it:
  - `usePlayback` → owned by `PreviewArea` (it's the only consumer of frame ticks)
  - `useEditorAutosave` → owned by `EditorLayout` (top-level concern)
  - `useEditorKeyboard` → owned by `EditorLayout` (top-level concern)
  - `useEditorClipActions` → owned by `EditorTimelineSection` (only consumer)
  - `useEditorTransport` → owned by `EditorToolbar` (only consumer)
  - `useEditorAssetMap` → stays in `EditorLayout`, provided via context (already done)
  - `useEditorProjectPoll` → stays in `EditorLayout`
  - `useEditorLayoutMutations` → inline into `EditorLayout` (thin wrapper)

- **Stop prop-drilling values that are in context**. `EditorWorkspace` and its children should read from `useEditorContext()` directly instead of receiving `tracks`, `currentTimeMs`, `isPlaying`, etc. as props. The context already exists — use it.

- **Result**: `EditorLayout` shrinks from 120 lines of prop-passing to ~30 lines. Each component is self-contained. No 40-field intermediate object.

```
Files to modify:
- frontend/src/features/editor/hooks/useEditorLayoutRuntime.ts (delete)
- frontend/src/features/editor/components/EditorLayout.tsx (simplify)
- frontend/src/features/editor/components/EditorWorkspace.tsx (read from context)
- frontend/src/features/editor/components/EditorToolbar.tsx (read from context)
- frontend/src/features/editor/components/PreviewArea.tsx (read from context, own usePlayback)
- frontend/src/features/editor/components/EditorTimelineSection.tsx (own clip actions)
```

---

### 7.2 Simplify the Store: Kill 30+ `useCallback` Wrappers

**Problem**: `useEditorStore.ts` (233 lines) is 30 individual `useCallback` wrappers that each do nothing except call `dispatch({ type: "X", ... })`. This is pure boilerplate — every new action requires adding a wrapper here, then a type in `EditorAction`, then a case in the reducer. Three files for one operation.

**Fix:**

- **Expose `dispatch` directly** (it's already stable — `useReducer` guarantees it). Components call `dispatch({ type: "ADD_CLIP", trackId, clip })` directly.
- **Or** keep the store but generate it. A typed `createEditorAction` helper can auto-generate the callbacks from the action union type at zero boilerplate cost.
- **Simplest path**: Keep only the ~5 actions that need extra logic (like `setCurrentTime` which needs clamping). Delete the rest and use `dispatch` directly. This cuts the file from 233 lines to ~40.

```
Files to modify:
- frontend/src/features/editor/hooks/useEditorStore.ts (simplify)
```

---

### 7.3 Flatten the Reducer Chain

**Problem**: The reducer dispatches through a 3-stage chain: `editorReducer` → `reduceSessionOps` → `reduceClipOps` → `reduceTrackOps`. Each returns `null` to signal "not my action" and pass to the next. This pattern:
- Makes control flow hard to follow (you need to read 4 files to trace one action)
- Prevents shared post-processing (like the overlap sanitization in Phase 0)
- Has no exhaustiveness checking — unknown actions silently return `state`

**Fix:**

- **Single reducer file with delegated helpers**. The main reducer has one `switch` statement that dispatches to helper functions. Each helper returns the new state directly — no null-chaining.

```typescript
// editor-reducer.ts
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  let next: EditorState;
  switch (action.type) {
    case "SET_CURRENT_TIME": next = { ...state, currentTimeMs: clamp(action.ms, 0, state.durationMs) }; break;
    case "ADD_CLIP":         next = addClip(state, action); break;
    case "MOVE_CLIP":        next = moveClip(state, action); break;
    // ... etc
    default: return state;
  }
  // Single post-processing pass for ALL actions
  return sanitizeTracksNoOverlap(next);
}
```

- Keep the helper functions in separate files (`clip-ops.ts`, `track-ops.ts`) but they return `EditorState`, not `EditorState | null`.
- The overlap sanitization from Phase 0 naturally lives as a single post-processing line here.

```
Files to modify:
- frontend/src/features/editor/model/editor-reducer.ts (rewrite as single switch)
- frontend/src/features/editor/model/editor-reducer-clip-ops.ts (return EditorState, not null)
- frontend/src/features/editor/model/editor-reducer-session-ops.ts (same)
- frontend/src/features/editor/model/editor-reducer-track-ops.ts (same)
```

---

### 7.4 Unify Clip Constraint Logic (Single Source of Truth)

**Problem**: Clip positioning constraints are scattered across 3 layers:
1. `clip-constraints.ts` — has `hasCollision`, `clampMoveToFreeSpace`, `clampTrimEnd`, `clampTrimStart`
2. `TimelineClip.tsx` — UI handlers call constraint functions before dispatching
3. `useEditorClipActions.ts` — `handleAddClip` calls `hasCollision` then toasts an error
4. The reducer — `PASTE_CLIP` calls `clampMoveToFreeSpace` (but `MOVE_CLIP` doesn't)

Nobody knows which layer is supposed to enforce the rules. Result: some paths check, most don't.

**Fix:**

- **The reducer is the ONLY enforcement point**. Period. The UI layer should dispatch freely — the reducer resolves to valid state.
- `clip-constraints.ts` functions are called exclusively from the reducer (via Phase 0's `sanitizeTracksNoOverlap`).
- `TimelineClip` drag handlers still compute visual snap positions for UX feedback (snapping during drag), but the final position is determined by the reducer, not the UI.
- `useEditorClipActions.handleAddClip` drops the `hasCollision` check — the reducer handles it. The toast can move to a `useEffect` that detects when a clip's `startMs` was auto-adjusted.

```
Files to modify:
- frontend/src/features/editor/hooks/useEditorClipActions.ts (remove constraint checks)
- frontend/src/features/editor/components/TimelineClip.tsx (keep visual snap, remove enforcement)
- frontend/src/features/editor/model/editor-reducer-clip-ops.ts (add enforcement)
```

---

### 7.5 Split `PreviewArea` Into Focused Components

**Problem**: `PreviewArea.tsx` (478 lines) does 5 unrelated things in one component:
1. Responsive sizing (ResizeObserver)
2. Video element rendering + sync
3. Audio element rendering + sync
4. Text overlay rendering
5. Caption canvas rendering

All of these depend on `currentTimeMs` but are otherwise independent. A bug in one area (like the video sync) is tangled with the others.

**Fix:**

Extract into focused sub-components:

```
PreviewArea.tsx (layout shell, ResizeObserver, composition container)
  ├── PreviewVideoLayer.tsx (video element rendering + sync per track)
  ├── PreviewAudioManager.tsx (audio elements, hidden, sync only)
  ├── PreviewTextOverlays.tsx (text clip rendering)
  └── PreviewCaptionCanvas.tsx (caption canvas, owns useCaptionCanvas)
```

Each sub-component reads `currentTimeMs` from context (or a time ref after Phase 1.1). Each can be memoized independently.

```
Files to create:
- frontend/src/features/editor/components/preview/PreviewVideoLayer.tsx
- frontend/src/features/editor/components/preview/PreviewAudioManager.tsx
- frontend/src/features/editor/components/preview/PreviewTextOverlays.tsx
- frontend/src/features/editor/components/preview/PreviewCaptionCanvas.tsx
Files to modify:
- frontend/src/features/editor/components/PreviewArea.tsx (becomes thin shell)
```

---

### 7.6 Simplify the Type Hierarchy

**Problem**: Clip types use a 4-level inheritance chain: `BaseClip → NamedClip → VisualClip → MediaClipBase → VideoClip`. But:
- `NamedClip` adds `label`, `enabled`, `speed` — these aren't always used (captions have none)
- `VisualClip` adds `opacity`, `warmth`, `contrast`, position — applied to audio clips too (which makes no sense, audio doesn't have `positionX`)
- Every clip type carries visual fields it doesn't use

**Fix:**

Flatten to 2 levels: `BaseClip` and the concrete types. Each concrete type declares only the fields it actually uses:

```typescript
interface BaseClip {
  id: string;
  startMs: number;
  durationMs: number;
  locallyModified: boolean;
}

interface VideoClip extends BaseClip {
  type: "video";
  label: string;
  enabled: boolean;
  speed: number;
  assetId: string | null;
  trimStartMs: number;
  trimEndMs: number;
  sourceMaxDurationMs?: number;
  // visual
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  // audio
  volume: number;
  muted: boolean;
  // placeholder
  isPlaceholder?: true;
  // ...
}

interface AudioClip extends BaseClip {
  type: "audio";
  label: string;
  enabled: boolean;
  speed: number;
  assetId: string | null;
  trimStartMs: number;
  trimEndMs: number;
  sourceMaxDurationMs?: number;
  volume: number;
  muted: boolean;
  // NO visual fields — audio doesn't have position/scale/opacity
}
```

This makes the type system tell the truth about what each clip actually supports. The `sanitizeClipPatch` function in the reducer already knows these distinctions — the types should match.

**Note**: This is a larger refactor. Lower priority than the other items but pays off in long-term clarity.

```
Files to modify:
- frontend/src/features/editor/types/editor.ts
- backend/src/types/timeline.types.ts
- backend/src/domain/editor/editor.schemas.ts
```

---

### 7.7 Backend: Deduplicate Timeline Building Logic

**Problem**: There are two separate code paths for building timelines from assets:
1. `SyncService.deriveTimeline` + `SyncService.buildVideoClips` — used for initial project creation and text content re-sync
2. `mergePlaceholdersWithRealClips` + `reconcileVideoClipsWithoutPlaceholders` — used for video generation completion

Both build video clips from assets, both compute sequential `startMs` positioning, both handle voiceover and music clips. But they use different logic, different code paths, and different overlap handling (or lack thereof).

**Fix:**

Extract a single `TimelineBuilder` class (or set of pure functions) that both paths call:

```
TimelineBuilder
  ├── buildVideoTrackFromAssets(assets, existingClips?) → clips[]
  ├── buildAudioClip(asset, role, volume) → clip
  ├── sequentialize(clips) → clips (resolve all overlaps, assign startMs)
  └── mergeWithUserClips(contentClips, userClips) → clips (always overlap-safe)
```

`SyncService.deriveTimeline` calls `TimelineBuilder.buildVideoTrackFromAssets` + `sequentialize`.
`mergePlaceholdersWithRealClips` calls `TimelineBuilder.buildVideoTrackFromAssets` (with existing clips for adjustment carry-forward) + `sequentialize`.

Overlap resolution lives in `sequentialize` — one function, used everywhere.

```
Files to create:
- backend/src/domain/editor/timeline/timeline-builder.ts
Files to modify:
- backend/src/domain/editor/sync/sync.service.ts (use TimelineBuilder)
- backend/src/domain/editor/timeline/merge-placeholders-with-assets.ts (use TimelineBuilder)
```

---

### 7.8 Kill `useEditorClipActions` — Inline into Components

**Problem**: `useEditorClipActions` is a hook that wraps 13 `useCallback`s, each of which wraps a single store method call. Most are 1-liners: `(clipId) => store.removeClip(clipId)`. The hook exists solely to be destructured in `EditorLayout` and passed as 13 individual props to `EditorTimelineSection`.

**Fix:**

- Timeline and its children already have access to `useEditorContext()` which exposes the store.
- Delete `useEditorClipActions`. Components call `store.removeClip(clipId)` directly from context.
- The only method with real logic is `handleAddClip` (collision check + toast) — that logic moves into the reducer per Phase 0/7.4.
- `handleFocusMediaForTrack` and `handleSelectTransition` are UI navigation concerns — they belong in the components that trigger them.

```
Files to delete:
- frontend/src/features/editor/hooks/useEditorClipActions.ts
Files to modify:
- frontend/src/features/editor/components/EditorLayout.tsx (remove clip action prop drilling)
- frontend/src/features/editor/components/EditorTimelineSection.tsx (read from context)
- frontend/src/features/editor/components/Timeline.tsx (read from context)
```

---

### 7.9 Summary: Structural Wins

| Change | Lines Removed (est.) | Complexity Reduced |
|--------|---------------------|--------------------|
| 7.1 Delete `useEditorLayoutRuntime` | ~150 lines + ~200 lines of prop drilling | Eliminates 40-field intermediate object |
| 7.2 Simplify store callbacks | ~190 lines | 30 boilerplate callbacks → dispatch or ~5 |
| 7.3 Flatten reducer chain | Net neutral (restructure) | Single entry point, exhaustive switch, one post-process hook |
| 7.4 Unify constraint enforcement | ~50 lines scattered checks | One enforcement point (reducer) |
| 7.5 Split PreviewArea | Net neutral (extract) | 5 focused components vs 1 monolith |
| 7.6 Flatten type hierarchy | ~20 lines of intermediate interfaces | Types match reality |
| 7.7 Deduplicate backend timeline building | ~100 lines duplicated logic | One builder, used everywhere |
| 7.8 Kill useEditorClipActions | ~130 lines + prop drilling | Direct context access |

**Total estimated reduction: ~840 lines of boilerplate/indirection removed.**

---

## Implementation Priority

| Priority | Phase | Item | Impact | Effort |
|----------|-------|------|--------|--------|
| P0 | 0.1 | Reducer-level `sanitizeTracksNoOverlap` + wire into `pushPastTracks` | Fixes ALL overlap bugs | Medium |
| P0 | 0.2 | Backend Zod overlap validation + server-side sanitization | Hard backstop | Small |
| P0 | 0.3 | Self-heal on `LOAD_PROJECT` | Fixes existing bad data | Tiny |
| P0 | 0.4 | Fix `clampMoveToFreeSpace` snap-back bug | Correct drag resolution | Small |
| P0 | 0.5 | Fix `mergeTrackSets` + `mergePlaceholdersWithRealClips` overlap | Fixes sync-created overlaps | Medium |
| P0 | 1.1 | Decouple playhead from React state | Fixes core lag | Medium |
| P0 | 1.2 | Deduplicate active clip computation | Quick fix | Tiny |
| P0 | 1.3 | Imperative video sync | Removes frame latency | Medium |
| P1 | 1.4 | Reduce preload window | Less bandwidth contention | Tiny |
| P1 | 2.1 | Memoize TimelineClip | Fewer re-renders | Small |
| P1 | 5.2 | Prune far-away video elements | Less memory/decode | Small |
| P1 | 5.3 | Caption canvas early-return | Skip useless renders | Tiny |
| P2 | 3.1 | FPS control UI | Feature request | Small |
| P2 | 3.3 | Speed control in inspector | Feature request | Small |
| P2 | 3.4 | Video metadata in inspector | Feature request | Medium |
| P2 | 4.4 | Caption doc query dedup | Export speed | Tiny |
| P2 | 5.1 | Limit waveform decode concurrency | Less thread contention | Small |
| P3 | 2.2 | Virtualize timeline clips | Scales to many clips | Medium |
| P3 | 4.1 | Stream assets to FFmpeg | Export speed | Medium |
| P3 | 4.2 | Hardware encoding | Export speed | Small |
| P3 | 4.3 | FFmpeg progress parsing | UX polish | Small |
| P3 | 6.1 | Error boundaries | Resilience | Small |
| P3 | 6.2 | Web Worker waveform | Initial load perf | Medium |
| P3 | 6.3 | Autosave hash check | Bandwidth savings | Small |
| P4 | 2.3 | Stabilize track references | Memoization foundation | Small |
| P4 | 5.4 | Operation-based undo | Memory reduction | Large |
| P1 | 7.1 | Collapse `useEditorLayoutRuntime` / kill prop drilling | ~350 lines removed, clearer ownership | Medium |
| P1 | 7.3 | Flatten reducer chain (single switch + post-process) | Enables Phase 0, clearer control flow | Small |
| P1 | 7.4 | Unify constraint enforcement in reducer only | Prevents overlap bug class permanently | Small |
| P2 | 7.2 | Simplify store callbacks → direct dispatch | ~190 lines boilerplate removed | Small |
| P2 | 7.5 | Split PreviewArea into focused sub-components | Independent memoization, isolate bugs | Medium |
| P2 | 7.7 | Deduplicate backend timeline builder | One overlap-safe builder for all paths | Medium |
| P2 | 7.8 | Kill `useEditorClipActions` → context direct | ~130 lines + prop drilling removed | Small |
| P3 | 7.6 | Flatten type hierarchy (clip types) | Types match reality | Medium |

---

## Success Metrics

- **Preview FPS during playback**: Target 60fps (currently drops to ~15-30fps with multiple clips)
- **Time to interactive after editor load**: Target <2s (currently blocked by waveform decodes)
- **Memory usage with 10 video clips**: Target <500MB (currently unbounded based on preload)
- **Export time for 60s video**: Baseline current, target 30% reduction with streaming + hw encode
- **Zero lag on seek/scrub**: Imperative sync should make scrubbing instant
