# Research: Editor UX Issues & Bugs — Batch Report

**Date:** 2026-03-25
**Status:** Open — 3 bugs, 2 UX improvements
**Priority:** High — bugs affect core editing workflow; UX issues erode trust on first use

---

## Overview

Five issues were identified through user testing of the editor. Three are bugs with clear behavioral failures; two are UX improvements where the current design is confusing or incomplete. All issues are grounded in the source code and are actionable.

---

## Issue 1 — Right-Click on Empty Track Space: Confusing "Paste Here"

**Type:** UX Improvement
**Severity:** Medium

### What the user sees

Right-clicking on any empty track area shows a one-item context menu: **"Paste Here"**. When nothing has been copied, the item is disabled — but the menu still appears. The user sees a grayed-out "Paste Here" and has no idea what they'd be pasting or what else they can do here.

### Root Cause

`TrackAreaContextMenu` in `ClipContextMenu.tsx` (line 143–158) only renders a single menu item:

```tsx
<ContextMenuItem onSelect={onPaste} disabled={!hasClipboard}>
  Paste Here
  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
</ContextMenuItem>
```

There is no "Add Clip" or "Add Text" action. The label "Paste Here" does not explain *what* will be pasted. The `Timeline` component wraps each track row in `TrackAreaContextMenu` and captures the right-click position to use as the paste target — this position tracking already works; it just has no secondary use.

### What the menu should do

The context menu for empty track space should be **context-sensitive** based on track type:

| Track Type | Menu Items |
|---|---|
| video | "Add Video Clip at Position", "Paste Clip Here" (if clipboard) |
| audio | "Add Audio Clip at Position", "Paste Clip Here" (if clipboard) |
| music | "Add Music Clip at Position", "Paste Clip Here" (if clipboard) |
| text | "Add Text Clip at Position", "Paste Clip Here" (if clipboard) |

The "Paste Here" label should also be renamed to "Paste Clip Here" and only appear when `hasClipboard` is true. When nothing is copied, the paste item should either be hidden or accompanied by a hint like "Copy a clip first (⌘C)".

"Add Text Clip at Position" should create a new blank `Clip` on the text track at the right-clicked `startMs`, with a default `textContent: ""` and `durationMs: 3000`, then select it so the user can immediately type in the Inspector.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/editor/components/ClipContextMenu.tsx` | Extend `TrackAreaContextMenu` to accept `trackType`, `onAddClip`, and show track-appropriate actions |
| `frontend/src/features/editor/components/Timeline.tsx` | Pass `trackType` and `onAddClip` props to each `TrackAreaContextMenu` |
| `frontend/src/features/editor/components/EditorLayout.tsx` | Wire up the new `onAddClip` callback through to the Timeline |

---

## Issue 2 — Text Clips: No Font Size Control; All Text Renders at Once

**Type:** UX Improvement (two sub-problems)
**Severity:** High

### Sub-problem A: No way to change text size

When a text clip is selected, the Inspector (`Inspector.tsx`) shows:

- Clip section (name, start, duration, speed, enabled)
- Look section (opacity, warmth, contrast)
- Transform section (X, Y, scale, rotation)
- Sound section (volume, mute, and a textarea for `textContent`)

There are **no controls for `textStyle`**. The `Clip` type already has a `textStyle` field (`TextStyle`: `fontSize`, `fontWeight`, `color`, `align`), but no Inspector controls set it. `PreviewArea.tsx` renders text at `clip.textStyle?.fontSize ?? 32` — so every text clip defaults to 32px with no user control.

**What's needed:** A "Text Style" section in the Inspector for text clips (when `clip.textContent !== undefined && !isCaptionClip`):
- Font size slider (12–120px)
- Font weight toggle (Normal / Bold)
- Color picker
- Alignment picker (Left / Center / Right)

These should call `onUpdateClip(id, { textStyle: { ...existing, [field]: value } })`.

### Sub-problem B: No temporal splitting — all text shows at once

A text clip's entire `textContent` string is displayed as a single block for the full duration of the clip. If the text is long, it all appears on screen simultaneously, regardless of the clip's duration. This is fine for a 1-word label but unusable for a full sentence or paragraph — users would need to manually split text into many tiny clips.

The correct behavior is to **split text into timed segments** matching the clip duration. Two reasonable approaches:

**Option A — Word-level splitting** (recommended for short-duration clips):
Distribute words evenly across the clip's duration. At any given playhead position, show only the words "active" at that moment. This mirrors how caption clips already work (using `captionWords` with per-word `startMs`/`endMs`).

**Option B — Line-based splitting** (simpler):
Split `textContent` by newlines or sentence boundaries. Each segment occupies an equal fraction of the clip's duration. The user controls the split by how they format the text in the Inspector textarea.

Option B is simpler and puts the user in control. Option A is more automatic but requires algorithmic timing.

The rendering logic in `PreviewArea.tsx` (lines 411–438) currently renders the full `clip.textContent` as a static `<div>`. It would need to compute which portion of the text to show based on `currentTimeMs - clip.startMs`.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/editor/components/Inspector.tsx` | Add "Text Style" section (fontSize, fontWeight, color, align) below the Sound section for non-caption text clips |
| `frontend/src/features/editor/components/PreviewArea.tsx` | For text clips, split `textContent` by lines/words and render only the active segment based on playhead position |
| `frontend/src/features/editor/types/editor.ts` | No changes needed — `TextStyle` interface already exists |

---

## Issue 3 — /studio/generate Projects Don't Show Without Page Reload

**Type:** Bug
**Severity:** High — new work is invisible to the user until they reload

### What the user sees

The user creates a new content generation (chat session → AI generates a reel). The project now exists on the backend. Navigating to `/studio/generate` shows a stale list that doesn't include the new project. The user must hard-reload the page to see it.

### Root Cause

`GeneratePage` (`generate.tsx`) fetches projects via `useProjects()`:

```typescript
const { data: projects, isLoading } = useProjects();
```

`useProjects` uses TanStack Query with `queryKey: queryKeys.api.projects()`. The query has **no `refetchInterval`** and relies entirely on explicit invalidation. When a new project is created (e.g. from a different session, or after AI content finishes generating), `invalidateChatProjectsQueries` should fire to refresh the list.

The gap is in `ChatLayout.tsx`. After the AI stream completes and content is saved, it calls:

```typescript
invalidateEditorProjectsQueries(queryClient);
invalidateQueueQueries(queryClient);
invalidateContentAssetsForGeneration(queryClient, contentId);
```

But `invalidateChatProjectsQueries` is **not called** after a new project is implicitly created by the generation flow. The project list query never gets invalidated — it only gets populated on initial page load.

Additionally, `useProjects` has no `staleTime` set, which means TanStack Query's default `staleTime: 0` applies — the query *should* refetch on window focus. But TanStack Query's window focus refetch only triggers if the query was already mounted and is stale, not if the data is absent. If the user never visits the generate page until after generating content, the query fetches fresh on mount, which should work — but if they navigate away and back without a full remount cycle, stale data persists.

**Most likely real root cause:** After generation completes and the user navigates to `/studio/generate`, the component is not remounting (SPA navigation) and TanStack Query serves the cached result from the previous mount. The projects query needs to be invalidated **at the point the generation stream finishes** or **when a new project is created**.

### Fix

In `ChatLayout.tsx`, inside the generation completion handler (where `isSavingContent` transitions to `false` or `streamingContentId` is set), add:

```typescript
await invalidateChatProjectsQueries(queryClient);
```

Additionally, add `refetchOnWindowFocus: true` (already the TanStack default, but explicitly setting it makes the intent clear) and consider a short `staleTime: 10_000` to avoid over-fetching on tab switches.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/chat/components/ChatLayout.tsx` | Call `invalidateChatProjectsQueries(queryClient)` after content generation completes |
| `frontend/src/features/chat/hooks/use-projects.ts` | Optionally add `staleTime: 10_000` and verify `refetchOnWindowFocus` behavior |

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

### Fix

Add a `sourceMaxDurationMs` field to the `Clip` interface. Set it at placement time from `asset.durationMs`. In `handleTrimRight`, compute the maximum allowed duration as:

```typescript
const sourceAvailable = (clip.sourceMaxDurationMs ?? Infinity) - clip.trimStartMs;
const maxAllowed = Math.min(sourceAvailable, /* next clip gap */);
newDuration = Math.min(newDuration, maxAllowed);
```

For the left trim handle, the minimum `startMs` is bounded such that `trimStartMs` never exceeds the source length.

**Note:** This constraint doesn't apply to text clips since they have no source asset. For caption clips (`captionWords`), the max duration is already bounded by the last word's `endMs`.

### Files to Change

| File | Change |
|---|---|
| `frontend/src/features/editor/types/editor.ts` | Add optional `sourceMaxDurationMs?: number` to `Clip` |
| `frontend/src/features/editor/components/MediaPanel.tsx` | Set `sourceMaxDurationMs: asset.durationMs` when creating clips |
| `frontend/src/features/editor/components/Timeline.tsx` | Pass `sourceMaxDurationMs` through to drop-created clips |
| `frontend/src/features/editor/utils/clip-constraints.ts` | Add `clampTrimEndToSource(clip, proposedDuration)` that incorporates `sourceMaxDurationMs` |
| `frontend/src/features/editor/components/TimelineClip.tsx` | Use `clampTrimEndToSource` in `handleTrimRight`; bound `handleTrimLeft` so `trimStartMs < sourceMaxDurationMs` |

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

| # | Issue | Type | Impact | Effort | Fix First? |
|---|---|---|---|---|---|
| 5 | Duplicate clip causes overlap | Bug | High — export artifacts, timeline corruption | Low (5 lines) | Yes |
| 3 | Projects don't show on generate page | Bug | High — work is invisible until reload | Low (1 invalidation call) | Yes |
| 1 | Right-click empty space: confusing "Paste Here" | UX | Medium — confusing; blocks discoverability | Low-Medium | Next sprint |
| 4 | Clips trimmable beyond source max | Bug | Medium — silent export garbage | Medium (new field + constraint) | Next sprint |
| 2 | Text clips: no font size; all text at once | UX | High — feature is half-built | High (Inspector + renderer) | Planned sprint |

Issues 5 and 3 are one-session fixes. Issues 1 and 4 are a sprint item together. Issue 2 (text clip styling + temporal segmentation) is a full feature — text clip sizing is a small Inspector addition (1 day), but word-timing is a meaningful feature requiring a design decision on the splitting algorithm.

---

## Files Referenced

| File | Relevant Lines |
|---|---|
| `frontend/src/features/editor/components/ClipContextMenu.tsx` | 143–158 (`TrackAreaContextMenu`) |
| `frontend/src/features/editor/components/Timeline.tsx` | 214–305 (track row + context menu) |
| `frontend/src/features/editor/components/Inspector.tsx` | 304–316 (text content textarea, no textStyle controls) |
| `frontend/src/features/editor/components/PreviewArea.tsx` | 411–438 (text clip rendering, static `textContent`) |
| `frontend/src/features/editor/components/TimelineClip.tsx` | 175–202 (`handleTrimRight`, no source max) |
| `frontend/src/features/editor/hooks/useEditorStore.ts` | 326–357 (`DUPLICATE_CLIP`, single-pass clamping) |
| `frontend/src/features/editor/utils/clip-constraints.ts` | 35–47 (`clampTrimEnd`), 8–29 (`clampMoveToFreeSpace`) |
| `frontend/src/features/editor/types/editor.ts` | 22–63 (`Clip` type, `TextStyle` interface) |
| `frontend/src/routes/studio/generate.tsx` | 11 (`useProjects` fetch, no refetch trigger) |
| `frontend/src/features/chat/components/ChatLayout.tsx` | Generation completion handler (missing `invalidateChatProjectsQueries`) |
