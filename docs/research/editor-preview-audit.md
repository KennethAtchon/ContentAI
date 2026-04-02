# Editor Preview -- Bug & UX Audit
*Date: 2026-03-28 | Last verified: 2026-04-02*
*Scope: frontend/src/features/editor/, backend/src/routes/editor/, frontend/src/routes/studio/editor.tsx*

---

## Critical Bugs (Broken Functionality)

### BUG-001: Export ignores all video tracks beyond the first
- **File:** `backend/src/domain/editor/merge-new-assets.ts:139`, `backend/src/domain/editor/timeline/merge-placeholders-with-assets.ts:60`
- **What's broken:** Both merge files use `tracks.find(t => t.type === "video")` which returns only the first video track. Any clips on secondary video tracks are silently dropped. The export pipeline in `run-export-job.ts` was fixed to use `.filter()`, but the merge-time logic still uses `.find()`.
- **Root cause:** `Array.find()` returns first match only. Should be `Array.filter()` to collect all video tracks.

### BUG-002: AI Assemble fails silently with no user feedback
- **Note:** Original file location (`EditorLayout.tsx:237-265`) has been refactored. Location of `aiAssemble` mutation is unconfirmed — needs re-verification.
- **What's broken:** The `aiAssemble` mutation has no `onError` handler. When the backend returns an error (no shot assets, no generated content, validation failure), the UI does nothing.
- **Root cause:** Missing `onError` callback on the `useMutation`. Should show a toast with the error message from the API response.

### BUG-003: AI Assemble dropdown has no click-outside-to-close behavior
- **Note:** Original file location (`EditorLayout.tsx:964-996`) has been refactored. Location of the AI menu is unconfirmed — needs re-verification.
- **What's broken:** The dropdown relies on `onMouseLeave` to close. Clicking anywhere else on the page leaves it open. Inconsistent with every other dropdown which uses Radix DropdownMenu.
- **Root cause:** Custom dropdown using `showAiMenu` state + `onMouseLeave` instead of Radix `DropdownMenu`.

---

## UX Problems (Works but Wrong)

### UX-002: Resolution picker gives no visual feedback when switching between same-aspect-ratio options
- **File:** `frontend/src/features/editor/components/ResolutionPicker.tsx` + `PreviewArea.tsx`
- **What's broken:** Changing from "9:16 HD (1080p)" to "9:16 4K" updates `state.resolution` from `"1080x1920"` to `"2160x3840"`. Both have the same 9:16 aspect ratio so the preview looks identical. The user thinks the button is broken.
- **Recommendation:** Show a brief toast "Resolution set to 4K (2160x3840)" on change.

### UX-004: Preview area does not show video for clips without a resolved asset URL
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx:397`
- **What's broken:** `src={assetUrlMap.get(clip.assetId ?? "") ?? ""}` — when `assetUrlMap` doesn't have the `assetId`, the video element gets `src=""`. An empty `src` on a `<video>` triggers a network request to the current page URL, which fails silently. The clip shows as blank with no loading indicator.
- **Root cause:** No loading state for unresolved assets. `src` attribute should be omitted entirely or a placeholder shown when the URL is unavailable.

### UX-005: Preview video elements are never cleaned up for removed clips
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx`
- **What's broken:** `videoRefs` is a `Map<string, HTMLVideoElement>` that grows as clips are rendered. During `MERGE_TRACKS_FROM_SERVER`, if clip IDs change, stale entries in the map can accumulate. Minor memory leak, not user-visible in short sessions.
- **Root cause:** No periodic cleanup of the `videoRefs`/`audioRefs` maps.

### UX-008: Editor timecode uses `HH:MM:SS:FF` but frames are meaningless at arbitrary fps
- **File:** `frontend/src/features/editor/utils/timecode.ts`
- **What's broken:** The timecode shows frame numbers derived from `Math.floor((ms % 1000) / (1000 / fps))`. Since the browser's `requestAnimationFrame` doesn't run at exactly 30fps, the frame counter can skip or stutter. The format implies frame-accurate positioning that the browser preview cannot deliver.
- **Root cause:** Timecode format borrowed from NLE conventions; browser rAF doesn't operate at a fixed frame rate.

---

## New Issues (Found During Verification)

### NEW-001: "Copied!" string in ExportModal is not translated
- **File:** `frontend/src/features/editor/components/ExportModal.tsx:222`
- **What's broken:** `{copied ? "Copied!" : t("editor_export_copy_url")}` — hardcoded English string breaks i18n.
- **Fix:** Replace `"Copied!"` with a translation key.

---

## Missing Features Referenced in Spec

### MISSING-001: Clip snapping has no visual snap-line feedback
- **File:** `frontend/src/features/editor/utils/snap-targets.ts`, `frontend/src/features/editor/components/TimelineClip.tsx`
- **Status:** Snap targets are computed and nearest-snap logic exists. During drag, clips snap but there is no visual snap line rendered on the timeline.

### MISSING-002: Drag-and-drop from media panel has no rejection visual for wrong-type tracks
- **File:** `frontend/src/features/editor/components/Timeline.tsx`
- **Status:** Valid drop target highlights with a subtle 8% opacity purple. There is no rejection visual when dragging a video clip over an audio track — the drop silently fails.

### MISSING-003: Color filter presets have no visual thumbnails
- **File:** `frontend/src/features/editor/components/MediaPanel.tsx`
- **Status:** Effects are wired and working. Preset tiles are text-only with param descriptions — no thumbnail, color swatch, or before/after preview.

### MISSING-004: No prominent aspect ratio toggle in the editor toolbar
- **Spec reference:** Section 3.1 — "An aspect ratio toggle (9:16 / 16:9 / 1:1)"
- **File:** `frontend/src/features/editor/components/ResolutionPicker.tsx`
- **Status:** Aspect ratio is buried inside a resolution dropdown (e.g., "1080x1920") rather than a prominent visual toggle.

### MISSING-005: ShotOrderPanel is not rendered anywhere in the editor
- **File:** `frontend/src/features/editor/components/ShotOrderPanel.tsx`
- **Status:** Component exists (148 lines, fully implemented with dnd-kit drag-to-reorder) but is never imported or rendered in `EditorLayout.tsx` or any other component. Dead code.

---

## Data Layer / State Issues

### DATA-002: addVideoTrack has a stale closure over state.tracks
- **File:** `frontend/src/features/editor/hooks/useEditorStore.ts`
- **What's broken:** `addVideoTrack` reads `state.tracks.filter(t => t.type === "video").length` to name the new track at callback creation time, not dispatch time. If two `addVideoTrack` calls fire in rapid succession before the first state update propagates, both generate "Video N+1" (duplicate names).
- **Root cause:** `useCallback` dependency on `[state.tracks]` is correct but the value is captured at creation time.

---

## Summary

| Category | Count |
|---|---|
| Critical Bugs | 3 (+ 2 need location re-verification) |
| UX Problems | 4 |
| New Issues | 1 |
| Missing Features (from spec) | 5 |
| Data/State Issues | 1 |

**Top priorities:**
1. **BUG-001** — Silent data loss on export (multi-track video dropped)
2. **BUG-002 / BUG-003** — Verify current location after EditorLayout refactor, then fix
3. **UX-004** — `src=""` on video element triggers bad network requests
