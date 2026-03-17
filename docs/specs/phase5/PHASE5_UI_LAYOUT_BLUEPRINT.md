# Phase 5 UI Layout Blueprint

Last updated: 2026-03-16
Related:
- `docs/specs/PHASE5_EDITING_SUITE_MVP.md`
- `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
- `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`

## Purpose

Define concrete layout architecture for the Phase 5 editor so implementation can ship a consistent quick-edit-first experience and a gated precision timeline experience across desktop and mobile.

## Information Architecture

Phase 5 editor runs as one route-level workspace with two tabs:

1. `Quick Edit` (default, MVP path)
2. `Precision` (post-MVP, feature-flagged)

Supporting regions:

- Media preview player
- Editing controls and inspector
- Asset tray
- Render panel

Recommended route shape:

- `/(customer)/generate/$generatedContentId/reel/edit`

## Screen Architecture

## 1) Quick Edit Mode (5A)

### Desktop Layout (>= 1024px)

- **Header row**: title, mode tabs, save status, version badge, actions (`Back`, `Render Final`)
- **Main 12-col grid**:
  - `col-span-7`: preview player + scrub bar
  - `col-span-5`: quick tools stack (`Trim`, `Reorder`, `Text`, `Captions`, `Transitions`)
- **Bottom rail**:
  - compact clip sequence strip for reorder context
  - selected clip metadata and trim handles

### Mobile Layout (< 1024px)

- Sticky header with mode tabs and render action
- Single-column stack:
  1. preview player
  2. quick tool segmented control
  3. active tool panel (trim/text/caption/transition)
  4. horizontal clip strip
- Inspector controls appear in bottom sheet (`80vh`) for dense settings

## 2) Precision Mode (5B)

### Desktop Layout (>= 1200px preferred)

- **Top row**: transport controls, timecode, zoom controls, undo/redo
- **Middle split**:
  - `col-span-8`: preview player and ruler
  - `col-span-4`: inspector panel (selected item properties)
- **Bottom timeline zone**:
  - multi-track timeline lanes (video/audio/text/captions)
  - playhead and markers
  - horizontal/vertical scroll
- **Left asset drawer** (collapsible): drag sources into timeline

### Mobile Layout (< 1200px fallback behavior)

- Precision mode is optional on mobile; if enabled:
  - single-track compressed timeline view
  - drawer-based track switching
  - reduced shortcut discoverability via actions menu
- If disabled, show guardrail messaging and keep Quick Edit path primary.

## Region Responsibilities

| Region | Responsibility | Must Not Do |
| --- | --- | --- |
| `EditorHeader` | navigation, mode switch, save/render status | host detailed clip controls |
| `PreviewPanel` | playback, scrub, visual output verification | mutate persisted composition directly |
| `QuickToolsPanel` | 5A edits with guided controls | expose dense frame-level settings |
| `PrecisionTimelinePanel` | frame-level track manipulation | hide failure state feedback |
| `InspectorPanel` | selected item properties and advanced controls | run async API calls directly without hook layer |
| `AssetTray` | import/select reusable assets | alter timeline timing implicitly |
| `RenderPanel` | render trigger, status, retry, version list | perform timeline edits |

## Component Tree

```text
Phase5EditorPage
  EditorHeader
  EditorModeTabs
  EditorShell
    PreviewPanel
      EditorPlayer
      PreviewScrubber
    QuickEditPanel
      TrimTool
      ReorderStrip
      TextOverlayTool
      CaptionStyleTool
      TransitionTool
    PrecisionTimelinePanel
      TimelineRuler
      TrackLaneList
      Playhead
      ShortcutHintBar
    InspectorPanel
    AssetTray
    RenderPanel
  EditorToastRegion
  EditorBlockingModalRegion
```

## Layout Rules (Implementation Constraints)

- Keep one prominent primary CTA per mode (`Render Final`).
- Preserve context when switching tabs (selection/playhead/zoom).
- Do not force full-page rerenders during timeline or polling updates.
- Keep save status visible in header in both modes.
- Ensure all critical actions remain keyboard and touch accessible.

## Responsive Guardrails

- Minimum editor-supported viewport for full precision mode: 1200x700.
- For smaller viewports, prefer Quick Edit controls and progressive disclosure.
- Maintain consistent preview aspect ratio with letterboxing where needed.

## Phase 4 Compatibility Rules

- If composition data unavailable, redirect safely to Phase 4 preview flow.
- Preserve current assembled output references until user completes a successful Phase 5 render.
- Never block Phase 6 export from previously rendered valid output.
