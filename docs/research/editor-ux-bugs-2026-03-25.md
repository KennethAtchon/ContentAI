# Research: Editor UX Issues & Bugs — Batch Report

**Date:** 2026-03-25
**Updated:** 2026-03-27 — Issues 1, 2, and 3 fixed and removed; Issue 4 partially complete
**Status:** Open — 2 bugs (1 partially complete)
**Priority:** High — bugs affect core editing workflow

---

## Overview

Two bugs remain. Issue 5 is a low-effort fix (5 lines). Issue 4 is partially done — the `sourceMaxDurationMs` field and trim enforcement are implemented for text clips; what remains is wiring it up for asset-backed clips (video/audio/music).

---

## Issue 4 — Clips Can Be Trimmed Beyond Their Source Max Duration

**Type:** Bug
**Severity:** Medium — produces silent export artifacts; clips play black frames beyond source end

### What the user sees

When dragging the right trim handle of a clip, there is no upper limit. Users can stretch a 5-second video clip to 60 seconds. Past the actual source video length, the preview renders black/frozen frames. The clip looks valid on the timeline but produces garbage in export.

### Root Cause

`handleTrimRight` in `TimelineClip.tsx` (lines 175–202):

```typescript
const onMove_ = (ev: MouseEvent) => {
  const dx = ev.clientX - startX;
  const deltaMs = (dx / zoom) * 1000;
  let newDuration = Math.max(100, origDuration + deltaMs);
  newDuration = clampTrimEnd(track, clip, newDuration); // ← only clamps against next clip
  pendingDuration = newDuration;
};
```

`clampTrimEnd` (in `clip-constraints.ts`) only prevents overlapping the **next clip on the same track**. It has no concept of the source asset's `durationMs`. The `Clip` type has no `maxDurationMs` field, and the `durationMs` stored on the asset is not passed through to the clip at placement time.

Similarly for the left trim: a user could trim from the left indefinitely, resulting in a negative `trimStartMs` that doesn't correspond to real source frames.

The asset's `durationMs` is available at placement time (`MediaPanel.tsx` line 167: `durationMs: asset.durationMs ?? 5000`) but is not preserved on the `Clip` for constraint enforcement during trim.

The same applies to audio/music clips.

### Fix (Remaining Work)

`sourceMaxDurationMs` already exists on `Clip` and `handleTrimRight` already enforces it (both added as part of text clip work). What remains is setting the value at **asset placement time**:

- In `MediaPanel.tsx` when a clip is created from a dragged asset, set `sourceMaxDurationMs: asset.durationMs`
- In `Timeline.tsx` when a clip is created via drop, set `sourceMaxDurationMs: asset.durationMs`

No changes needed to `clip-constraints.ts` or `TimelineClip.tsx` — the enforcement is already in place.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/editor/components/MediaPanel.tsx` | Set `sourceMaxDurationMs: asset.durationMs` when creating clips |
| `frontend/src/features/editor/components/Timeline.tsx` | Set `sourceMaxDurationMs` on drop-created clips |

---

## Issue 5 — Duplicate Clip Causes Overlap

**Type:** Bug
**Severity:** High — violates the core non-overlap invariant, breaks timeline integrity

### What the user sees

Right-clicking a clip and selecting "Duplicate" (or using ⌘D) places the copy on top of an existing clip instead of after the last clip in the track. The duplicated clip visually overlaps, producing export artifacts where two clips compete for the same time range.

### Root Cause

`DUPLICATE_CLIP` case in `useEditorStore.ts` (lines 326–357):

```typescript
const proposedStart = clip.startMs + clip.durationMs;
const clampedStart = clampMoveToFreeSpace(
  track,
  "new",
  proposedStart,
  clip.durationMs
);
```

`clampMoveToFreeSpace` performs a **single-pass** collision check. It iterates over all other clips and, if it finds one collision, resolves it by snapping to either before or after the blocking clip. But if resolving that collision creates a new collision with a third clip, the function does not re-iterate — it returns an overlapping position.

Example: clips at [0–5s], [5–10s], [10–15s]. Duplicating the clip at [0–5s]:
- `proposedStart = 5s`
- Collision with [5–10s]: snap after → `10s`
- **No re-check**: collision with [10–15s] is not detected
- Result: duplicate lands at `10s`, overlapping [10–15s]

The intended behavior — "append at the end of the track" — is not what the code implements. The code tries to insert at `clip.startMs + clip.durationMs` (immediately after the original) and then nudges for collisions, rather than finding the track's actual end.

### Fix

Replace the `DUPLICATE_CLIP` placement logic with an "append at track end" strategy:

```typescript
case "DUPLICATE_CLIP": {
  for (const track of state.tracks) {
    const clip = track.clips.find((c) => c.id === action.clipId);
    if (!clip) continue;

    // Find the actual end of all clips on this track
    const trackEnd = track.clips.reduce(
      (max, c) => Math.max(max, c.startMs + c.durationMs),
      0
    );

    const copy: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      startMs: trackEnd, // append after the last clip, no overlap possible
      locallyModified: true,
    };
    // ... rest unchanged
  }
}
```

This guarantees no overlap by definition — the duplicate always starts at the current track end. The `clampMoveToFreeSpace` call is no longer needed for duplicate (though it should stay for paste/move operations).

Additionally, `clampMoveToFreeSpace` itself should be hardened to run in a loop until no collision is found (bounded to `clips.length` iterations) rather than single-pass, to handle edge cases in paste operations.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/editor/hooks/useEditorStore.ts` (line 326–357) | Replace `proposedStart = clip.startMs + clip.durationMs` with `trackEnd = max(c.startMs + c.durationMs)` |
| `frontend/src/features/editor/utils/clip-constraints.ts` | Harden `clampMoveToFreeSpace` to loop until collision-free (for paste path) |

---

## Priority Summary

| # | Issue | Type | Impact | Effort | Status |
|---|---|---|---|---|---|
| 5 | Duplicate clip causes overlap | Bug | High — export artifacts, timeline corruption | Low (5 lines) | Open |
| 4 | Clips trimmable beyond source max | Bug | Medium — silent export garbage | Low (placement wiring only) | Partial — text clips done; asset clips remain |

Issue 5 is a 5-line fix. Issue 4 only needs `sourceMaxDurationMs` set at placement time in `MediaPanel.tsx` and `Timeline.tsx` — the field, trim constraint, and enforcement logic are already in place.

---

## Files Referenced

| File | Relevant Lines |
|---|---|
| `frontend/src/features/editor/components/TimelineClip.tsx` | `handleTrimRight` — enforces `sourceMaxDurationMs` when set |
| `frontend/src/features/editor/hooks/useEditorStore.ts` | `DUPLICATE_CLIP` — still uses single-pass `clampMoveToFreeSpace` |
| `frontend/src/features/editor/utils/clip-constraints.ts` | `clampMoveToFreeSpace` — single-pass, needs loop hardening |
| `frontend/src/features/editor/types/editor.ts` | `Clip.sourceMaxDurationMs` — field exists; not set on asset clips yet |
| `frontend/src/features/editor/components/MediaPanel.tsx` | Clip placement — needs `sourceMaxDurationMs: asset.durationMs` |
| `frontend/src/features/editor/components/Timeline.tsx` | Drop placement — needs `sourceMaxDurationMs` on drop-created clips |
