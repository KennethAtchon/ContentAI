# Editor Timeline: Red Team Analysis & Library Evaluation

_Date: 2026-03-23_

---

## TL;DR

**Don't switch to a library. Fix the specific bugs.**

There is no drop-in React timeline library that fits this use case. The bugs are not architectural — they are localized implementation gaps that are days of work to fix, not weeks.

---

## Library Evaluation

| Library | Verdict |
|---|---|
| `react-timeline-editor` (xzdarcy) | Animation keyframe model, not NLE clip model. Wrong domain. |
| Remotion Timeline | Requires adopting Remotion's full render pipeline. Architectural rewrite + $600+. |
| `dnd-timeline` | Headless scheduling library. You'd rebuild everything from scratch on top of it. |
| Twick (`@twick/timeline`) | 2025 baby project. Too new for production. |
| IMG.LY CE.SDK | Enterprise pricing, replaces your entire editor — overkill. |
| Vidstack | Playback player only. Not a timeline editor at all. |

**Why none of these work:** The gap in the ecosystem is real. No well-maintained open-source React library handles media clip trim semantics, waveform rendering, overlap detection, transition markers, and custom clip content in one package. The closest candidates either require full architectural buy-in (Remotion) or are too immature (Twick).

**What a migration would actually cost:** Any viable library (dnd-timeline, xzdarcy) requires rewriting clip rendering, waveform integration, placeholder states, i18n strings, and domain-specific snap logic. Conservatively 3–5× the effort of fixing the current bugs.

---

## Red Team Report

**Artifact type:** Code (React frontend)
**Files reviewed:** `TimelineClip.tsx`, `useEditorStore.ts`, `EditorLayout.tsx`, `Timeline.tsx`, `PreviewArea.tsx`, `usePlayback.ts`
**Total findings:** 12 (🔴 4 critical · 🟠 5 high · 🟡 3 medium)

---

### 🔴 CRITICAL — Trim destroys the undo stack

**Files:** `TimelineClip.tsx:107–114`, `useEditorStore.ts:159–171`

`handleTrimLeft` and `handleTrimRight` call `onTrimStart`/`onTrimEnd` (→ `dispatch(UPDATE_CLIP)`) on **every `mousemove` event**. Unlike the drag handler which updates the DOM directly and commits only on `mouseUp`, trim fires a full state dispatch per pixel.

`UPDATE_CLIP` unconditionally pushes to `state.past`. A single 100px trim gesture produces ~100 entries in the undo stack. With the 50-entry cap, this wipes out all prior history. Undoing a trim requires hammering Cmd+Z 50+ times. Trim also causes a React re-render per pixel and resets the 2s auto-save debounce on every pixel (save may never fire while trimming). **This is the primary reason trim feels broken.**

**Fix:** Adopt the same pattern as `handleDragStart` — mutate `clipRef.current.style.left/width` directly during drag, commit once to the store on `mouseUp`. Trim should add exactly one entry to `past`.

---

### 🔴 CRITICAL — Audio/music tracks are silent in preview

**File:** `PreviewArea.tsx:181–226`

`PreviewArea` only creates `<video>` elements for the video track. Audio track clips (`voiceover`, `music`) have no corresponding `<audio>` elements and no playback logic. The inspector shows volume and mute controls for audio clips. Users hear nothing. The entire audio mixing workflow produces zero audible output in preview.

**Fix:** Create `<audio>` elements for each audio/music track clip, synced to playback state the same way video elements are.

---

### 🔴 CRITICAL — Caption canvas aspect ratio is inverted

**File:** `PreviewArea.tsx:231–232`

```tsx
<canvas ref={captionCanvasRef} width={1920} height={1080} ...
```

The canvas is hardcoded to 1920×1080 (landscape 16:9). The default resolution is `1080x1920` (portrait 9:16). Caption positioning in `use-caption-preview.ts` uses `canvas.width/height` for centering — so captions are drawn relative to a landscape canvas but displayed in a portrait container. Text appears in the wrong position on every portrait video.

**Fix:** Set `width={resW}` and `height={resH}` using the values already parsed at line 89 of `PreviewArea.tsx`.

---

### 🔴 CRITICAL — No overlap/collision detection anywhere

**Files:** `Timeline.tsx`, `useEditorStore.ts`

No clip interaction — drag, trim, drop, duplicate, split — checks for overlap with other clips on the same track. `MOVE_CLIP`, `UPDATE_CLIP`, `ADD_CLIP`, `DUPLICATE_CLIP` all place clips freely. Clips visually stack on top of each other. The renderer (`PreviewArea.tsx:93–96`) returns all clips at the current time and stacks video elements at full opacity, producing undefined compositing. Fundamental NLE invariant violated.

**Fix:** Add a `clampToFreeSpace(track, clip, proposedStartMs)` utility returning the nearest non-overlapping position. Call it in drag/trim commit and in the reducer for `MOVE_CLIP`/`ADD_CLIP`/`DUPLICATE_CLIP`.

---

### 🟠 HIGH — `REORDER_SHOTS` orphans all transitions

**File:** `useEditorStore.ts:391–420`

`REORDER_SHOTS` reassigns `startMs` for all video clips but does not touch `track.transitions`. Transitions store `clipAId`/`clipBId` by ID. After a reorder, `Timeline.tsx` renders diamonds between clips by array index (line 219), not by transition clip IDs. All configured transitions become orphaned or point to wrong clip pairs after a drag-reorder.

**Fix:** Clear `transitions: []` in `REORDER_SHOTS`, or rebuild the transition list matching old clipA→clipB pairs to new index positions.

---

### 🟠 HIGH — `zoomFit` uses a hardcoded 800px width

**File:** `EditorLayout.tsx:413`

```ts
const containerW = 800;
const newZoom = state.durationMs > 0 ? (containerW / state.durationMs) * 1000 : 40;
```

This never reads the actual timeline container width. On any real screen (sidebar + inspector eat space), "Fit" calculates the wrong zoom level.

**Fix:** Attach a `ref` to the timeline scrollable container and read `ref.current.clientWidth`.

---

### 🟠 HIGH — Clicking a transition diamond creates a spurious undo entry

**File:** `EditorLayout.tsx:281`

```ts
store.setTransition(trackId, clipAId, clipBId, "none", 500);
```

`handleSelectTransition` always calls `setTransition` to ensure a transition record exists. `SET_TRANSITION` always pushes to `state.past`. Clicking any diamond that has no prior configuration adds a `type: "none"` 500ms transition to undo history. With many clips, clicking around to inspect fills the 50-entry undo limit with no-op transitions.

**Fix:** Check if a transition already exists before calling `setTransition`. Only create it when the user explicitly changes the type in the Inspector.

---

### 🟠 HIGH — Publish does not flush the auto-save debounce

**File:** `EditorLayout.tsx:605–613`

The Publish button calls `publishProject()` immediately. `scheduleSave` is debounced by 2 seconds. If the user edits something and publishes within 2 seconds, the in-flight save timer is still pending — the PATCH hasn't fired. The published version on the server is missing their last edit. **Data loss on the critical publish action.**

**Fix:** Before calling `publishProject()`, flush the debounced save synchronously — clear the timer, call `save()` directly, then chain `publishProject` in the mutation's `onSuccess`.

---

### 🟠 HIGH — Keyboard shortcut effect re-runs 60×/sec during playback

**File:** `EditorLayout.tsx:388–390`

```ts
}, [store, handleRemoveClip]);
```

`store` is the return value of `useEditorReducer()`, which creates a new object every render. Playback calls `setCurrentTime` at ~60fps → 60 re-renders/sec → deps change → the keydown listener is removed and re-added 60 times per second during playback.

**Fix:** Stabilize deps. Use `useRef` inside the handler to access `isPlaying`/`currentTimeMs`, or wrap the handler in `useCallback` with stable deps only.

---

### 🟡 MEDIUM — Waveform instances accumulate indefinitely

**File:** `use-waveform.ts`

The module-level `waveformCache: Map<string, WaveSurfer>` caches instances keyed by `audioUrl` and never evicts them. Each WaveSurfer instance holds a decoded audio buffer. In a long editing session with many audio files, memory grows without bound.

**Fix:** Add a max-size eviction policy (LRU, e.g. cap at 20 entries) or destroy instances on unmount when no other component references the same URL.

---

### 🟡 MEDIUM — `MERGE_TRACKS_FROM_SERVER` blocks all audio updates on any local edit

**File:** `useEditorStore.ts:472–475`

```ts
const hasLocalEdits = localTrack.clips.some((c) => c.locallyModified);
if (hasLocalEdits) return localTrack;
return serverTrack;
```

If the user trims a single audio clip (`locallyModified: true`), the entire audio track is frozen from server updates for the rest of the session. New server-generated voiceovers will never appear after AI assembly if the user has touched any audio clip.

**Fix:** Apply per-clip merge logic (as done for the video track) rather than all-or-nothing at the track level.

---

### 🟡 MEDIUM — Transition diamonds render between non-adjacent clips

**File:** `Timeline.tsx:219`

```ts
track.clips.slice(0, -1).map((clipA, idx) => {
  const clipB = track.clips[idx + 1];
```

A diamond renders between every consecutive pair in the clips array regardless of whether they're actually adjacent in time. If there's a gap between clip A (ends at 5s) and clip B (starts at 8s), a diamond appears in the gap. The transition math in `PreviewArea.tsx:54–56` will never trigger for non-adjacent clips, so the diamond is misleading.

**Fix:** Only render a diamond when `clipA.startMs + clipA.durationMs >= clipB.startMs - threshold`.

---

## Fix Priority Order

| Priority | Fix | Effort |
|---|---|---|
| 1 | Trim buffering (ref-based, commit on mouseUp) | ~20 lines |
| 2 | Audio `<audio>` elements in PreviewArea | ~40 lines |
| 3 | Caption canvas dimensions from `resW`/`resH` | 2 lines |
| 4 | Overlap clamping utility | ~30 lines |
| 5 | `zoomFit` reads actual container width | 2 lines |
| 6 | `REORDER_SHOTS` clears orphaned transitions | ~5 lines |
| 7 | Publish flushes debounced save first | ~10 lines |
| 8 | Transition diamond only on adjacent clips | ~5 lines |
| 9 | `handleSelectTransition` doesn't create on click | ~5 lines |
| 10 | Keyboard shortcut effect stable deps | ~15 lines |

## What's Solid

- **Domain model** (`Track/Clip/Transition` types) is well-structured and specific to the problem
- **Drag-to-move** is correctly implemented with ref-based DOM mutation and single commit on mouseUp
- **Snap logic** is cleanly separated in `snap-targets.ts` and operates in ms-domain correctly
- **Placeholder merge** logic handles `locallyModified` correctly for video clips during server polling
- **Waveform caching** is a smart optimization — just needs a size cap
