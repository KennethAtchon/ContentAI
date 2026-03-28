# Timeline Clip Resize: Trim Behavior (Bug Fix)

**Date:** 2026-03-28
**Priority:** P0 (blocks core editing workflow)
**Status:** Fixed (2026-03-28)

---

## Problem Statement

When a user drags the edge of a timeline clip to resize it, the clip's playback speed changes instead of trimming the clip. Expanding a 20-second clip to 30 seconds on the timeline produces a 30-second clip that plays at 0.67x speed (slow motion). Shrinking a 20-second clip to 10 seconds produces a clip that plays at 2x speed.

This is fundamentally wrong. Every video editor users have ever touched (CapCut, Premiere, DaVinci, iMovie) treats edge-drag as a trim operation. Users expect to reveal or hide portions of the source media, not to alter playback speed. This behavior will confuse every single user and undermine trust in the editor.

---

## Current (Wrong) Behavior

1. User places a 20s video clip on the timeline.
2. User drags the right edge to make the clip visually wider.
3. The clip's `durationMs` increases (e.g., to 30000ms).
4. On playback, the same 20s of source video is stretched over 30s, playing at ~0.67x.
5. Dragging the left edge has the analogous problem: it shifts the start but changes effective speed.

**Root cause (technical):** The resize handlers in `TimelineClip.tsx` do update `trimStartMs`, `trimEndMs`, and `durationMs` correctly at the data-model level. The actual bug is one of two things (engineering to confirm):

- **Hypothesis A:** `sourceMaxDurationMs` is not populated on clips created by the AI assembly pipeline or drag-and-drop from the media panel. Without this value, the right-trim handler has no upper bound and allows `durationMs` to exceed the source media's actual length. The preview/export path then stretches the video to fill the longer duration.
- **Hypothesis B:** The preview renderer and/or ffmpeg export pipeline does not use `trimStartMs` / `trimEndMs` to seek into the source file. Instead it naively maps `durationMs` to a playback window, which stretches or compresses the source when `durationMs` diverges from the source length.

Both hypotheses may be true simultaneously. Engineering should verify both paths.

---

## Expected (Correct) Behavior — the Trim/Crop Model

Resizing a clip on the timeline is a **trim** (also called crop) operation. The mental model:

- The source media has a fixed, immutable duration (e.g., 20 seconds).
- The clip on the timeline shows a **window** into that source.
- `trimStartMs` defines how far into the source the window begins.
- `trimEndMs` defines how much of the source tail is hidden.
- `durationMs` = `sourceMaxDurationMs - trimStartMs - trimEndMs`. This is always derived from trim values, never independent.
- Playback speed is always 1x unless the user explicitly changes it via the speed control in the inspector/context menu.

**Dragging the right edge outward (expand):**
- Decreases `trimEndMs` (reveals more of the source tail).
- Increases `durationMs` accordingly.
- Cannot expand beyond the point where `trimEndMs = 0` (all source content is revealed on the right side).
- Playback speed does not change.

**Dragging the right edge inward (shrink):**
- Increases `trimEndMs` (hides more of the source tail).
- Decreases `durationMs` accordingly.
- Minimum `durationMs` is 100ms to prevent zero-length clips.
- Playback speed does not change.

**Dragging the left edge outward (expand left):**
- Decreases `trimStartMs` (reveals earlier source content).
- The clip's timeline `startMs` moves earlier to accommodate.
- Cannot expand beyond `trimStartMs = 0`.
- Playback speed does not change.

**Dragging the left edge inward (shrink left):**
- Increases `trimStartMs` (hides earlier source content).
- The clip's timeline `startMs` moves later.
- Playback speed does not change.

---

## Edge Cases

| Case | Expected Behavior |
|---|---|
| Clip is already fully expanded (trimStartMs=0, trimEndMs=0) | Edge handles provide no-op resistance. Clip cannot grow larger than source. Visual feedback: handle does not move. |
| Clip has speed != 1x (user set via inspector) | Trim still operates on source-time, not playback-time. A 20s source at 2x speed occupies 10s on timeline. Expanding that clip reveals more source frames but the revealed frames also play at 2x. Maximum timeline width = sourceMaxDurationMs / speed. |
| Text/caption clips (no source media) | These have no fixed source duration. Resizing text clips SHOULD change their display duration freely (current behavior is acceptable for text). This fix applies only to clips with a backing media asset (video, audio, music, voiceover). |
| Clip created by AI assembly pipeline | `sourceMaxDurationMs` MUST be populated at assembly time from the actual asset duration. This is likely the missing piece. |
| Clip added via drag-and-drop from media panel | Same requirement: `sourceMaxDurationMs` must be set from the asset's known duration at drop time. |
| User drags edge into an adjacent clip | Existing collision logic (`clampTrimEnd`, `clampTrimStart`) already handles this. No change needed. |

---

## User Stories

- As a creator, I want dragging a clip edge to trim/reveal content so that I can cut my clip to the right length without changing its speed.
- As a creator, I want to be prevented from expanding a clip beyond its source duration so that I do not accidentally create slow-motion or silence.
- As a creator, I want speed changes to only happen when I explicitly set them in the inspector so that my edits are predictable.

---

## Acceptance Criteria

1. **Trim right:** Dragging the right edge of a video/audio clip changes `durationMs` and `trimEndMs` inversely. Playback speed remains unchanged. The clip cannot be extended beyond `sourceMaxDurationMs - trimStartMs`.
2. **Trim left:** Dragging the left edge changes `trimStartMs`, `startMs`, and `durationMs`. Playback speed remains unchanged. `trimStartMs` cannot go below 0.
3. **Source duration populated:** Every clip created from a media asset (via AI assembly, drag-and-drop, or any other path) has `sourceMaxDurationMs` set to the asset's actual duration in milliseconds.
4. **Preview correctness:** The in-browser preview seeks to `trimStartMs` in the source file and plays at the clip's `speed` for `durationMs / speed` of source time. No stretching.
5. **Export correctness:** The ffmpeg export pipeline uses `-ss` (seek) and `-t` (duration) based on `trimStartMs` and `durationMs` rather than stretching the source to fit.
6. **Text clips unaffected:** Clips without a media asset (text, captions) can still be freely resized without a source-duration cap.
7. **Speed remains explicit:** The `speed` property is only modified through the inspector speed control or the context menu speed option, never as a side-effect of resizing.

---

## Out of Scope (Defer)

- **Ripple trim** (automatically shifting downstream clips when trimming) — useful but separate feature.
- **Slip editing** (moving the source window without moving the clip on the timeline) — professional feature, not MVP.
- **Rate-stretch as an intentional tool** (Premiere-style rate stretch mode) — could add later behind a modifier key, but the default drag MUST be trim.

---

## Implementation Notes

The data model (`Clip` interface in `frontend/src/features/editor/types/editor.ts`) already has the right fields: `trimStartMs`, `trimEndMs`, `sourceMaxDurationMs`, `speed`. The `TimelineClip.tsx` handlers already compute trim values. The likely gaps are:

1. `sourceMaxDurationMs` is not being set on clip creation in the assembly pipeline (`backend/src/routes/editor/services/build-initial-timeline.ts`) or in the media panel drop handler.
2. The preview component may not be seeking to `trimStartMs` when playing back clips.
3. The export pipeline may not be applying trim offsets as seek parameters.

Start with (1) because without `sourceMaxDurationMs`, the trim handler has no upper bound and the bug is guaranteed to reproduce.

### Key Files

| File | Relevance |
|---|---|
| `frontend/src/features/editor/components/TimelineClip.tsx` (lines 131–213) | Resize drag handlers — where trim logic lives |
| `frontend/src/features/editor/utils/clip-constraints.ts` | Collision/clamping logic — needs source-duration bound |
| `frontend/src/features/editor/types/editor.ts` | `Clip` interface with `trimStartMs`, `trimEndMs`, `sourceMaxDurationMs`, `speed` |
| `frontend/src/features/editor/components/Timeline.tsx` (~line 380) | Trim callbacks dispatch to store |
| `backend/src/routes/editor/services/build-initial-timeline.ts` | Where `sourceMaxDurationMs` must be set during AI assembly |
