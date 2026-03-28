# Editor Preview -- Bug & UX Audit
*Date: 2026-03-28*
*Scope: frontend/src/features/editor/, backend/src/routes/editor/, frontend/src/routes/studio/editor.tsx*

---

## Critical Bugs (Broken Functionality)

### BUG-001: Export ignores all video tracks beyond the first
- **File:** `backend/src/routes/editor/index.ts:1113`
- **What's broken:** The export pipeline uses `tracks.find(t => t.type === "video")` which returns only the first video track. Any clips on secondary video tracks (Video 2, Video 3, etc.) are silently dropped from the exported file. The user can spend time compositing across multiple video tracks and the export produces a video missing those layers entirely.
- **Root cause:** `Array.find()` returns first match only. Should be `Array.filter()` to collect all video tracks, then build a compositing filtergraph that stacks them (z-order matches the track array order in the frontend).

### BUG-002: AI Assemble fails silently with no user feedback
- **File:** `frontend/src/features/editor/components/EditorLayout.tsx:237-265`
- **What's broken:** The `aiAssemble` mutation has an `onSuccess` handler but no `onError` handler. When the backend returns an error (no shot assets, no generated content, validation failure), the UI does nothing. The dropdown closes, the button stops spinning, and the user has no idea what happened. Common failure scenario: project has generated content but the shots haven't finished generating yet -- backend returns 400 "No shot clips available" and the user sees nothing.
- **Root cause:** Missing `onError` callback on the `useMutation`. Should show a toast with the error message from the API response.

### BUG-003: AI Assemble dropdown has no click-outside-to-close behavior
- **File:** `frontend/src/features/editor/components/EditorLayout.tsx:964-996`
- **What's broken:** The dropdown relies on `onMouseLeave` to close. If the user clicks the button to open the menu, then clicks anywhere else on the page (not the menu), the dropdown stays open. Only hovering over the menu and then leaving it will close it. This is inconsistent with every other dropdown in the app which uses Radix DropdownMenu with proper focus management.
- **Root cause:** Custom dropdown implementation using `showAiMenu` state + `onMouseLeave` instead of using the existing Radix `DropdownMenu` component. The `onMouseLeave` approach also fails on touch devices entirely.

### BUG-004: Export modal has no error handling for the enqueue request itself
- **File:** `frontend/src/features/editor/components/ExportModal.tsx:25-35`
- **What's broken:** The `enqueue` mutation has no `onError` handler. If the backend rejects the export request (e.g., 429 "Too many active export jobs", 404 project not found, or 500 server error), the modal shows nothing -- the button just stops being in its "Starting..." state with no feedback. The user has no idea the export failed before it even started.
- **Root cause:** Missing `onError` callback on the mutation. The backend explicitly returns meaningful error messages (429 with "Too many active export jobs") that are being silently swallowed.

### BUG-005: Export modal resolution/fps options are disconnected from editor state
- **File:** `frontend/src/features/editor/components/ExportModal.tsx:20-21`
- **What's broken:** The export modal initializes its own local state for resolution (`"1080x1920"`) and fps (`30`), completely ignoring the project's current resolution and fps settings. If the user changed the resolution to landscape (1920x1080) via the ResolutionPicker in the toolbar, and then opens the export modal, it defaults to 1080x1920 portrait. They would have to manually re-select the correct resolution.
- **Root cause:** `useState("1080x1920")` and `useState<24 | 30 | 60>(30)` are hardcoded defaults instead of being initialized from the project's current `resolution` and `fps` values. The `ExportModal` component receives `projectId` but not the current resolution/fps from the editor state.

---

## UX Problems (Works but Wrong)

### UX-001: "30 fps" label displayed in preview area serves no purpose and misleads
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx:509`
- **What's broken:** The preview meta row shows `{resW} x {resH} . {fps} fps` (e.g., "1080 x 1920 . 30 fps"). The fps value is always 30 (hardcoded default in the DB schema at `backend/src/infrastructure/database/drizzle/schema.ts:495` and in `useEditorStore.ts:59`). There is no UI anywhere in the editor to change fps -- it can only be set at export time in the ExportModal. Displaying "30 fps" in the preview implies the preview runs at 30fps, which is false (the browser renders via requestAnimationFrame at the display's refresh rate). It also implies the export will be at 30fps, but the user can choose 24 or 60 in the export modal.
- **Root cause:** The fps field is carried over from the data model but is not user-settable in the editor. Showing it in the preview creates false expectations. Either make fps editable in the editor (via ResolutionPicker or a dedicated control) or remove it from the preview display. The timecode display (`formatHHMMSSFF`) also uses fps to calculate frame numbers, which is legitimate -- but the badge display is misleading.

### UX-002: Resolution picker gives no visual feedback when switching between same-aspect-ratio options
- **File:** `frontend/src/features/editor/components/ResolutionPicker.tsx` + `PreviewArea.tsx:316-320`
- **What's broken:** Changing from "9:16 HD (1080p)" to "9:16 4K" updates `state.resolution` from `"1080x1920"` to `"2160x3840"`. But since both have the same 9:16 aspect ratio, the preview container looks identical. The only visible change is the tiny resolution badge in the top-right corner of the preview (line 497-499). The user clicks "4K", nothing perceptibly happens, and they think the button is broken. This is the likely root cause of the "9:16/4K button doesn't work" complaint.
- **Root cause:** The resolution picker changes a setting that only matters at export time (output pixel dimensions), not preview time. No toast, no visual indicator, no animation acknowledges the change. The select dropdown does show the new value, but the preview area looks identical.
- **Recommendation:** Show a brief toast "Resolution set to 4K (2160x3840)" on change. Or add a visible quality badge overlay on the preview that flashes when changed.

### UX-004: Preview area does not show video for clips without a resolved asset URL
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx:398`
- **What's broken:** `src={assetUrlMap.get(clip.assetId ?? "") ?? ""}` -- when assetUrlMap doesn't have the assetId (common during initial load, or for library items not yet fetched), the video element gets `src=""`. An empty `src` on a `<video>` element triggers a network request to the current page URL, which fails silently. The clip shows as a blank/black rectangle with no loading indicator. The user doesn't know if the clip is broken or still loading.
- **Root cause:** No loading state for unresolved assets, and `src=""` is used as a fallback instead of omitting the `src` attribute entirely or showing a placeholder.

### UX-005: Preview video elements are never cleaned up for removed clips
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx:394-409`
- **What's broken:** `videoRefs` is a `Map<string, HTMLVideoElement>` that grows as clips are rendered but only removes entries when the element ref cleanup fires (via React's ref callback on unmount). If a clip is removed and React unmounts the `<video>` element, the ref callback removes it. However, if the same clip ID is re-added (e.g., undo after delete), the old element is gone and a new one is created, which is correct. But during MERGE_TRACKS_FROM_SERVER, if clip IDs change, stale entries in the videoRefs map could accumulate. This is a minor memory leak, not user-visible in short sessions.
- **Root cause:** No periodic cleanup of the videoRefs/audioRefs maps.

### UX-006: Inspector "Sound" section shows volume/mute controls for text clips
- **File:** `frontend/src/features/editor/components/Inspector.tsx:340-387`
- **What's broken:** Every selected clip shows the Sound section with Volume slider and Mute toggle, including text clips which have no audio. Adjusting volume on a text clip has no effect. The text content textarea is also buried inside the Sound section (line 374-386) which is semantically wrong -- text editing should be a separate section, not a child of Sound.
- **Root cause:** No conditional rendering to hide Sound section for text-only clips (`clip.textContent !== undefined` or `trackType === "text"`).

### UX-007: Inspector sections use hardcoded English labels instead of i18n
- **File:** `frontend/src/features/editor/components/Inspector.tsx:188, 273, 300, 341, 170`
- **What's broken:** Section headers "Clip", "Look", "Transform", "Sound", and the "Inspector" title are all hardcoded English strings, not using the `t()` translation function. Property labels ("Name", "Start", "Duration", "Speed", "Enabled", "Opacity", etc.) are also hardcoded. This breaks i18n for any non-English user.
- **Root cause:** Section was built without i18n integration. Every user-facing string should use translation keys.

### UX-008: Editor timecode uses `formatHHMMSSFF` but frames are meaningless at arbitrary fps
- **File:** `frontend/src/features/editor/utils/timecode.ts` (via `PreviewArea.tsx:303` and `EditorLayout.tsx:640`)
- **What's broken:** The timecode shows `HH:MM:SS:FF` (hours, minutes, seconds, frames) using the project's fps (always 30). The frame number is derived from `Math.floor((ms % 1000) / (1000 / fps))`. Since the browser's requestAnimationFrame doesn't run at exactly 30fps, the frame counter can appear to skip or stutter. This creates a professional-looking timecode that is technically wrong -- it implies frame-accurate positioning that the browser preview cannot deliver.
- **Root cause:** Timecode format borrowed from NLE conventions but the underlying playback engine (rAF in a browser) doesn't operate at a fixed frame rate. The frame number is cosmetic at best.

### UX-009: No visual loading/error state for export job creation in the ExportModal
- **File:** `frontend/src/features/editor/components/ExportModal.tsx:146-156`
- **What's broken:** When the "Export" button is clicked, the text changes to "Starting..." while `isPending` is true. If the request takes a long time or the network is slow, there's no spinner, no progress indication, just static text. If the request fails, nothing happens (see BUG-004). Even the "Starting..." text is hardcoded English, not translated.
- **Root cause:** Minimal loading state treatment. The "Starting..." string should use `t()`.

### UX-010: Preview area film-strip edge decoration wastes horizontal space
- **File:** `frontend/src/features/editor/components/PreviewArea.tsx:322-323`
- **What's broken:** 3px-wide decorative film sprocket strips are rendered on the left and right edges of the preview container (`w-3 bg-repeating-sprocket`). These eat into the already limited preview width (the editor has a media panel on the left and inspector on the right). On smaller screens or with the default 9:16 aspect ratio, the actual video preview is already quite narrow. 6px of purely decorative elements is wasted space.
- **Root cause:** Design choice that prioritizes aesthetics over usable preview real estate. Not a bug, but hurts usability in a layout-constrained environment.

---

## Missing Features Referenced in Spec

### MISSING-001: Clip snapping has no visual snap-line feedback
- **Spec reference:** Section 3.3 -- "A vertical snap line appears at the snap point as visual feedback"
- **File:** `frontend/src/features/editor/utils/snap-targets.ts`, `frontend/src/features/editor/components/TimelineClip.tsx:91-129`
- **Status:** Snap targets are computed and nearest-snap logic exists. During drag, clips snap to adjacent edges and playhead. But there is no visual snap line rendered on the timeline. The user feels the "magnetic" behavior but cannot see where the snap occurred or what it snapped to.
- **Impact:** Without visual feedback, snapping feels unpredictable rather than precise.

### MISSING-002: Drag-and-drop from media panel has no drop target highlighting on tracks
- **Spec reference:** Section 3.4 -- "The drop target highlights to confirm the track accepts the asset type"
- **File:** `frontend/src/features/editor/components/Timeline.tsx:156-211`
- **Status:** Drag-and-drop from the media panel IS implemented. The timeline handles dragover/drop correctly and even validates asset type against track type. A subtle purple background appears when dragging over a valid track (`dropTargetTrackId` state, line 348-349). However, there is no rejection visual -- dragging a video over the audio track silently ignores the drop with no visual indicator that the track doesn't accept that type. The highlight color is also extremely subtle (8% opacity purple).
- **Impact:** User doesn't know which tracks will accept their drag until they try dropping.

### MISSING-003: Color filter presets apply values but have no live preview thumbnail
- **Spec reference:** Section 6.2 -- "The existing Effects tab has presets defined but they are no-ops. Wire them to actually apply..."
- **File:** `frontend/src/features/editor/components/MediaPanel.tsx:377-411`
- **Status:** Effects ARE wired and working -- clicking applies contrast/warmth/opacity. Hover preview is also implemented (onMouseEnter sends patch to effectPreviewOverride). But the preset tiles are just text buttons with param descriptions ("contrast: 20 . warmth: 10 . opacity: 1"), not visual thumbnails. There's no before/after preview or color swatch showing what the effect looks like. This makes the feature feel unfinished even though it works.

### MISSING-004: No aspect ratio toggle in the editor toolbar
- **Spec reference:** Section 3.1 -- "An aspect ratio toggle (9:16 / 16:9 / 1:1) allows horizontal content creators to change it"
- **File:** `frontend/src/features/editor/components/ResolutionPicker.tsx`
- **Status:** The ResolutionPicker select dropdown contains 9:16, 16:9, and 1:1 options, so technically the aspect ratio can be changed. But it's buried inside a 130px-wide dropdown labeled by resolution numbers (e.g., "1080x1920") rather than being a prominent toggle with visual aspect ratio indicators. The spec calls for a quick toggle, not a dropdown that mixes resolution with aspect ratio.

### MISSING-005: ShotOrderPanel is not rendered anywhere in the editor
- **File:** `frontend/src/features/editor/components/ShotOrderPanel.tsx`
- **Status:** The component exists and is fully implemented (drag-to-reorder shots via dnd-kit), but it is never imported or rendered in `EditorLayout.tsx`, `Inspector.tsx`, or any other component. It's dead code. The spec implies shot reordering should be accessible from the editor.
- **Root cause:** Component was built but never integrated into the layout.

---

## Data Layer / State Issues

### DATA-001: Undo/redo does not capture resolution or fps changes
- **File:** `frontend/src/features/editor/hooks/useEditorStore.ts:133-134`
- **What's broken:** `SET_RESOLUTION` action updates `state.resolution` directly without pushing to the `past` stack. If a user changes resolution and then hits Ctrl+Z, the resolution change is not undone. Same for `SET_TITLE` and `SET_PLAYBACK_RATE`. Only track-modifying actions push to the undo stack.
- **Impact:** Minor -- resolution changes are rare. But inconsistent undo behavior is confusing when it happens.

### DATA-002: addVideoTrack callback has a stale closure over state.tracks
- **File:** `frontend/src/features/editor/hooks/useEditorStore.ts:943-955`
- **What's broken:** `addVideoTrack` is a `useCallback` with `[state.tracks]` in its dependency array. It reads `state.tracks.filter(t => t.type === "video").length` to name the new track. But the callback is recreated on every tracks change, which is correct. However, the track count is read at callback creation time, not dispatch time. If two addVideoTrack calls fire in rapid succession before the first one's state update propagates, both will generate "Video N+1" (same name). This is a minor naming collision, not a functional bug.

### DATA-003: LOAD_PROJECT resets undo history but doesn't reset currentTimeMs
- **File:** `frontend/src/features/editor/hooks/useEditorStore.ts:107-128`
- **What's broken:** When `LOAD_PROJECT` fires, it resets `past: []` and `future: []` (undo history), but does NOT reset `currentTimeMs`. If the user is at timecode 45s in project A, then navigates to project B (which is only 10s long), the playhead starts at 45s which is past the end of the timeline. The `SET_CURRENT_TIME` action clamps to >= 0 but does NOT clamp to <= durationMs.
- **Root cause:** LOAD_PROJECT should set `currentTimeMs: 0` (or the line `currentTimeMs: Math.max(0, action.ms)` in SET_CURRENT_TIME should also clamp to durationMs).

---

## Summary

| Category | Count |
|---|---|
| Critical Bugs | 5 |
| UX Problems | 10 |
| Missing Features (from spec) | 5 |
| Data/State Issues | 3 |

**Top 3 to fix immediately:**
1. **BUG-001** (Export ignores multi-track video) -- Users lose work. Silent data loss in the most important output.
2. **BUG-002** (AI Assemble silent failure) -- Core feature that appears totally broken to users when assets aren't ready.
3. **BUG-005** (Export modal ignores editor resolution) -- Users export at wrong resolution without realizing it.
