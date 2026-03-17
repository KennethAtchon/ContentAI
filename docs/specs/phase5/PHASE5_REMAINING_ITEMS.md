## Phase 5 – Remaining Work (Implementation Delta)

**Last updated:** 2026-03-17  
**Scope:** Gaps between specs and current implementation for the in-browser editing suite.

---

### 1. Backend

- **Composition validation depth**
  - Current: Structural/temporal/ownership checks for basic tracks.
  - Remaining:
    - Transition-duration vs. source-span validation for all transition types.
    - Stricter caption timing validation (no overlaps, clamped to duration).
    - Optional “soft warnings” for pacing/clip-length rules defined in product docs.

- **Render orchestration**
  - Current: Composition-based render job queuing + status/retry + version asset creation.
  - Remaining:
    - Fine-grained progress reporting phases (decode → graph-build → encode) surfaced consistently.
    - Defensive guards around very long compositions (upper bound enforcement from product limits).

---

### 2. Frontend – 5A Quick Edit MVP

- **Preview parity**
  - Current:
    - Real video playback from assets (assembled or clip fallback).
    - Playhead scrubber tied to video `currentTime`.
  - Remaining:
    - Overlay of text/captions/transition hints on top of video (canvas or layered DOM).
    - Visual indication of selection (clip/text) aligned with preview frame/time.

- **Timeline & tools**
  - Current:
    - Single-lane video strip with drag-reorder + duration trim.
    - Quick tools for:
      - Move clip up/down within lane.
      - Trim (+/− 0.5s, direct duration input).
      - Add/edit/remove text overlays (basic timing + content).
      - Toggle captions + cycle style presets.
      - Keyboard: undo/redo, delete, split.
  - Remaining:
    - Visual handles for trim directly on the strip (mouse drag).
    - Clear transition icons on clips and scrub-synced preview of transitions.
    - Per-clip metadata display (source type, duration, transition summary).

- **Media bin**
  - Current:
    - Media bin listing of video/audio assets.
    - “Add to timeline” for video clips appending to main lane.
  - Remaining:
    - Drag-and-drop insertion into specific positions.
    - Visual grouping and labels (e.g., “Phase 4 shots”, “Uploads”).
    - Empty-state guidance with inline CTAs (generate/upload).

- **Editor shell polish**
  - Current:
    - Dedicated Studio Editor tab: `/studio/editor` + `/studio/editor/:generatedContentId`.
    - Editor header with version, save status, undo/redo, history trail.
  - Remaining:
    - Guard rails when no composition exists but assets are present (prompt init vs. error).
    - Clear, persistent keyboard shortcut reference (help/hint surface).

---

### 3. Frontend – 5B Precision Editing (Post-MVP)

Per the Phase 5 docs, precision mode is intentionally **not** implemented yet. Remaining work includes:

- Multi-track precision timeline with:
  - Dedicated lanes for video/audio/text/captions.
  - Ruler, playhead, zoom, scroll.
  - Snapping behavior (grid, edges, beat marks).
- Frame-accurate scrubbing:
  - Timecode display synced to playhead.
  - J/K/L, I/O keyboard transport.
- Precision tools:
  - Split at playhead with visual indicators.
  - Bring-in tool (drag assets into tracks with placement previews).
  - Per-track volume/opacity keyframes with curve editor.
- Undo/redo depth:
  - Hardening to 50+ operations with explicit visual stacks.

---

### 4. UX, Testing, and Release Gates

- **UX completeness**
  - Remaining:
    - Mobile/editor fallback behavior for narrow viewports (quick edit only).
    - Accessibility pass on editor controls and announcements (playhead, selection, save/render).

- **Automated tests**
  - Remaining:
    - Contract tests for all composition/render endpoints (happy path + conflicts + failures).
    - UI tests for:
      - Editor route navigation (Studio Editor → specific draft).
      - Timeline operations (reorder, trim, split, delete).
      - Autosave and validation flows.
      - Render lifecycle (queued → rendering → completed/failed + retry).

- **Observability & go/no-go**
  - Remaining:
    - Metrics and dashboards wired to composition save/validate/render events.
    - Alerts for save/render failure rate spikes and latency breaches.
    - Formal test run against `PHASE5_TEST_AND_RELEASE_CRITERIA` prior to enabling 5A for all users.

---

### 5. Summary – What Ships Next

**Next recommended milestones:**

1. **Finish 5A Quick Edit parity**
   - Live overlay rendering, transition visualization, improved timeline UX.
2. **Harden editor reliability**
   - Error surfaces, autosave robustness, validation clarity, observability.
3. **Gate and build 5B Precision**
   - Multi-lane timeline, frame tools, keyboard transport, deep undo/redo.

This document should be kept in sync with:

- `PHASE5_IMPLEMENTATION_TODO.md`
- `PHASE5_EDITING_SUITE_MVP.md`
- `PHASE5_TECHNICAL_DESIGN.md`

