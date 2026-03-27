# Multi-Video Track Bugs — Research & Fix Paper

**Date:** 2026-03-26
**Scope:** `Timeline.tsx`, `TrackHeader.tsx`, `useEditorStore.ts`
**Status:** Research complete — ready for implementation

---

## Executive Summary

Four related bugs were introduced when multi-video track support was added:

1. "Add Video Track" button renders below ALL tracks instead of after the last video track
2. Track area does not visually constrain to the parent container height (scrollable area doesn't activate)
3. `addVideoTrack` appends the new track to the end of the array via `ADD_TRACK`, bypassing the correct insertion logic already present in `ADD_CLIP_AUTO_PROMOTE`
4. Several reducer cases operate on the **first** video track by type, silently ignoring secondary tracks (state isolation failure)

---

## Bug 1 — "Add Video Track" Button Position

### Symptom
The "+ Add Video Track" button renders at the **bottom of the headers column**, after Audio, Music, and Text tracks. The user expects it to appear **inline with the last video track header**, adjacent to the mute/lock/remove buttons.

### Root Cause

**`Timeline.tsx` lines 193–201:**
```tsx
{tracks.map((track) => (
  <TrackHeader key={track.id} ... />
))}
{/* Add Video Track button */}
<button onClick={onAddVideoTrack} ...>
  <Plus size={13} />
  <span className="text-xs">{t("editor_add_video_track")}</span>
</button>
```

The button is a sibling rendered unconditionally after the full `tracks.map()`. Because tracks are ordered `[Video 1, Video 2, ..., Audio, Music, Text]`, the button ends up after Text — far from the video section.

The user also wants the button inline with the lock/mute controls — i.e., a compact `+` icon button that sits in the track header row itself, not a full-height row below everything.

### Fix

**Option A (recommended): Inline `+` in the last video track header**

Add a `isLastVideoTrack` prop to `TrackHeader`. When true, render a `+` icon button at the end of the controls row (after the trash button). This puts the "add track" affordance right where the user expects it — attached to the existing video track header row, alongside mute/lock/remove.

```tsx
// TrackHeader.tsx — add prop
interface Props {
  // ...
  isLastVideoTrack?: boolean;
  onAddVideoTrack?: () => void;
}

// Inside TrackHeader JSX, after the {canRemove && ...} block:
{isLastVideoTrack && onAddVideoTrack && (
  <button
    onClick={(e) => { e.stopPropagation(); onAddVideoTrack(); }}
    title={t("editor_add_video_track")}
    className="w-6 h-6 rounded flex items-center justify-center border-0 cursor-pointer transition-colors bg-transparent text-dim-3 hover:text-studio-accent"
  >
    <Plus size={11} />
  </button>
)}
```

**`Timeline.tsx` change:**

```tsx
// Compute the last video track id before the map
const lastVideoTrackId = videoTracks.at(-1)?.id;

{tracks.map((track) => (
  <TrackHeader
    key={track.id}
    track={track}
    // ...
    isLastVideoTrack={track.id === lastVideoTrackId}
    onAddVideoTrack={onAddVideoTrack}
    canRemove={track.type === "video" && videoTracks.length > 1}
    onRemove={() => onRemoveTrack(track.id)}
  />
))}
// Remove the standalone <button onClick={onAddVideoTrack}> block entirely
```

**`contentHeight` fix:**

With the button removed from the headers column, remove the `+ 1` from the `contentHeight` calculation:

```tsx
// Before (line 90):
const contentHeight = RULER_HEIGHT + (tracks.length + 1) * TRACK_HEIGHT;

// After:
const contentHeight = RULER_HEIGHT + tracks.length * TRACK_HEIGHT;
```

---

## Bug 2 — Track Area Not Scrollable

### Symptom
When there are many tracks, they overflow off the bottom of the timeline pane without showing a scrollbar.

### Root Cause

The scroll architecture is intentional and correct in principle:
- Right panel (`scrollRef`): `overflow-x-auto overflow-y-auto` — user-scrollable
- Left header column: `overflow-y-hidden` — user-scroll disabled, synced programmatically via `scrollTop`
- Sync: `onScroll` on right panel → `headerColumnRef.current.scrollTop = e.currentTarget.scrollTop`

The actual issue is a **height constraint gap**. The outer Timeline container is:

```tsx
<div className="flex flex-row h-full border-t border-overlay-sm bg-studio-surface overflow-hidden">
```

`h-full` makes the Timeline fill whatever height it's given by EditorLayout. If that parent container does **not** have a fixed/constrained height (e.g., it grows with content via `flex-1` in an unbounded flex column), the Timeline's `h-full` resolves to `auto`/`0`, and the scrollable right panel never activates because the content never overflows.

The `contentHeight` computed in px is set on the **inner** content div:
```tsx
<div style={{ width: totalWidthPx, height: contentHeight, position: "relative" }}>
```

But if the outer wrapper is unconstrained, adding more height to the inner div just makes the wrapper grow rather than triggering scroll.

### Fix

Verify that every ancestor of `<Timeline>` between `EditorLayout` and the root `h-screen` element uses `overflow-hidden` or has an explicit constrained height. The key chain is typically:

```
h-screen (root)
  └─ grid-rows-[auto_1fr] or flex-col
       └─ flex-1 min-h-0    ← CRITICAL: min-h-0 prevents flex children from growing unbounded
            └─ Timeline (h-full)
                 └─ scrollRef (overflow-y-auto)
```

The fix is to ensure the Timeline's parent has `min-h-0` (or `overflow-hidden`) so `h-full` resolves to a real pixel value. Without `min-h-0`, a flex child can grow past its container.

**In EditorLayout.tsx**, find where Timeline is rendered inside a flex column and add `min-h-0`:

```tsx
// The timeline section in EditorLayout — add min-h-0
<div className="flex-1 min-h-0 overflow-hidden">
  <Timeline ... />
</div>
```

---

## Bug 3 — New Video Track Inserted at the End Instead of After Last Video Track

### Symptom
When clicking "+ Add Video Track", the new track appears after Text (the last track) instead of immediately below the last existing video track.

### Root Cause

**`useEditorStore.ts` line 909:**
```ts
dispatch({ type: "ADD_TRACK", track });
```

**`ADD_TRACK` case (lines 726–733):**
```ts
case "ADD_TRACK": {
  return {
    ...state,
    tracks: [...state.tracks, action.track],  // ← always appends to END
  };
}
```

The track order is `[Video 1, Audio, Music, Text]`. Appending gives `[Video 1, Audio, Music, Text, Video 2]` — wrong visual position.

Note: `ADD_CLIP_AUTO_PROMOTE` (lines 218–227) already has correct insertion logic:
```ts
const lastVideoIdx = state.tracks.reduce(
  (last, t, i) => (t.type === "video" ? i : last),
  0
);
newTracks = [
  ...state.tracks.slice(0, lastVideoIdx + 1),
  newTrack,
  ...state.tracks.slice(lastVideoIdx + 1),
];
```
This inserts after the last video track position. The same logic needs to be in `addVideoTrack`.

### Fix

Change `addVideoTrack` to inline-insert after the last video track instead of using `ADD_TRACK`:

```ts
// useEditorStore.ts — addVideoTrack callback
const addVideoTrack = useCallback(() => {
  const videoCount = state.tracks.filter((t) => t.type === "video").length;
  const newTrack: Track = {
    id: crypto.randomUUID(),
    type: "video",
    name: `Video ${videoCount + 1}`,
    muted: false,
    locked: false,
    clips: [],
    transitions: [],
  };
  const lastVideoIdx = state.tracks.reduce(
    (last, t, i) => (t.type === "video" ? i : last),
    -1
  );
  const insertAt = lastVideoIdx >= 0 ? lastVideoIdx + 1 : state.tracks.length;
  const newTracks = [
    ...state.tracks.slice(0, insertAt),
    newTrack,
    ...state.tracks.slice(insertAt),
  ];
  dispatch({
    type: "SET_TRACKS_DIRECT",  // new action — or inline via UNDO-aware action
    tracks: newTracks,
  });
}, [state.tracks]);
```

**Alternatively** (simpler, no new action type): dispatch a payload-carrying action. Add `INSERT_TRACK_AT` to the reducer:

```ts
case "INSERT_TRACK_AT": {
  const tracks = [
    ...state.tracks.slice(0, action.insertAt),
    action.track,
    ...state.tracks.slice(action.insertAt),
  ];
  return {
    ...state,
    past: [...state.past, state.tracks].slice(-50),
    future: [],
    tracks,
  };
}
```

Then `addVideoTrack` dispatches `INSERT_TRACK_AT` with the correct index. This is undo-aware and clean.

---

## Bug 4 — Video Tracks Sharing / Corrupting Each Other's State

### Symptom
With two video tracks, operations on one track sometimes affect the other, or the second track is ignored entirely. Specifically: shot reordering, merge-from-server, and context-menu paste position can behave unexpectedly.

### Root Cause — Three sub-issues

#### 4a. `REORDER_SHOTS` targets the first video track only

**`useEditorStore.ts` lines 590–591:**
```ts
case "REORDER_SHOTS": {
  const videoTrack = state.tracks.find((t) => t.type === "video");
```

`find` returns the **first** video track. A user reordering shots in `Video 2` would have their action silently applied to `Video 1` instead (or ignored if the clip IDs don't match).

**Fix:** Pass the `trackId` with the action:
```ts
case "REORDER_SHOTS": {
  const videoTrack = state.tracks.find(
    (t) => t.id === action.trackId  // explicit track id, not type fallback
  );
```

Update the action type and `reorderShots` callback accordingly:
```ts
const reorderShots = useCallback(
  (trackId: string, clipIds: string[]) =>
    dispatch({ type: "REORDER_SHOTS", trackId, clipIds }),
  []
);
```

All callers (ShotOrderPanel, etc.) must pass the track id.

#### 4b. `MERGE_TRACKS_FROM_SERVER` falls back to type-matching

**`useEditorStore.ts` lines 655–658:**
```ts
const serverTrack =
  serverTracks.find((t) => t.id === localTrack.id) ??
  serverTracks.find((t) => t.type === localTrack.type);  // ← dangerous fallback
```

When a second video track exists locally but the server doesn't have it (server only has `Video 1`), this fallback matches `Video 2` (local) → first video track on server. The merge logic then overwrites `Video 2`'s clips with `Video 1`'s server data.

**Fix:** Remove the type-based fallback. If no ID match, the track is local-only and should be preserved as-is:

```ts
const serverTrack = serverTracks.find((t) => t.id === localTrack.id);
if (!serverTrack) return localTrack;  // local-only track — preserve unchanged
```

This is correct because the server's `refreshEditorTimeline` only manages the primary tracks. Secondary user-added tracks are purely local until the user saves.

#### 4c. `pastePositionRef` is shared across all tracks — benign but fragile

**`Timeline.tsx` line 163:**
```tsx
const pastePositionRef = useRef<number>(0);
```

This ref is mutated in the `onContextMenu` handler of whichever track was right-clicked, then read by the same track's `handleAddClipAtPosition`. Because context menus are synchronous (right-click sets the ref, then the menu item click reads it — both in the same browser event sequence), there's no actual race.

However, if the user right-clicks Track A, then (without selecting a menu item) right-clicks Track B — Track B's `onContextMenu` overwrites the ref. When they then click a deferred menu item from Track A's context (which the browser keeps open), they'd get Track B's position. This is an edge case but worth noting.

**Fix (low priority):** Move `pastePositionRef` inside the per-track map callback as a local closure variable, or use a `Record<trackId, number>` ref. Since only one context menu can be open at a time, the current implementation is safe in practice.

---

## Summary Table

| # | Bug | Location | Severity | Fix Complexity |
|---|-----|----------|----------|----------------|
| 1 | "Add Video Track" button at bottom | `Timeline.tsx:193`, `TrackHeader.tsx` | Medium — UX | Low |
| 2 | Tracks not scrollable | `EditorLayout.tsx` (ancestor height) | High — functional | Low |
| 3 | New track appends to end of array | `useEditorStore.ts:726` (`ADD_TRACK`) | Medium — UX | Low |
| 4a | `REORDER_SHOTS` ignores track id | `useEditorStore.ts:590` | High — data corruption | Medium |
| 4b | `MERGE_TRACKS_FROM_SERVER` type fallback | `useEditorStore.ts:656` | High — data corruption | Low |
| 4c | `pastePositionRef` shared | `Timeline.tsx:163` | Low — edge case | Low |

---

## Implementation Order

1. **Bug 2** — fix scrollability first (height constraint); all other bugs are easier to test once scroll works
2. **Bug 3** — add `INSERT_TRACK_AT` to reducer, update `addVideoTrack`
3. **Bug 1** — move "+ Add Video Track" into `TrackHeader`, remove standalone button, fix `contentHeight`
4. **Bug 4b** — remove type-based fallback in `MERGE_TRACKS_FROM_SERVER`
5. **Bug 4a** — add `trackId` to `REORDER_SHOTS`, update callers
6. **Bug 4c** — optional, low priority

No DB schema changes required. No migration needed.
