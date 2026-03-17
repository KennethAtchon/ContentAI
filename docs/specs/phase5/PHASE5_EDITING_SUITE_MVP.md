# Phase 5 In-Browser Editing Suite MVP

Last updated: 2026-03-16
Owner: Reel Editor + Media Pipeline
Status: Draft for implementation

## Goal

Ship an optional, browser-native editing layer on top of Phase 4 output so users can:

- fine-tune AI-generated reels without leaving ContentAI
- preview edits quickly without full server-render cycles
- produce an updated final MP4 through a reliable async render flow

Phase 5 must preserve the AI-first promise: users can publish directly from Phase 4 with no manual editing required.

## User Outcome

After a reel is assembled in Phase 4, users can:

1. Open editor
2. Apply quick edits (trim, reorder, text overlays, caption style, transitions)
3. Preview edits in-browser
4. Click `Render Final`
5. Receive updated downloadable MP4 version

Power users can optionally use a precision timeline tab for frame-level operations after 5A is stable.

## User Segments and Jobs-To-Be-Done

### Segment A: AI-first creator (default)

- Prefers speed over deep controls
- Wants lightweight corrections only
- Expects safe defaults and predictable output

Primary jobs:

- fix one weak clip
- add short text callout
- adjust caption readability
- re-render quickly

### Segment B: Power creator (secondary)

- Accepts complexity for precision
- Needs keyboard and timeline tools
- Wants frame-level control without leaving web app

Primary jobs:

- split clip at exact frame
- insert clip/audio at precise time
- adjust timing and transitions more granularly

## Scope

### In Scope (Phase 5A MVP)

- Composition persistence for editable reel projects
- Quick Edit Mode:
  - clip trim in/out
  - clip reorder
  - text overlays (preset fonts/sizes/colors/positions/animations)
  - caption style preset and caption toggle/edit
  - transition preset selection (`cut`, `crossfade`, `swipe`)
- In-browser preview playback with scrub support
- `Render Final` flow (async job + polling + retry)
- Versioned output behavior that keeps prior assembled output recoverable

### In Scope (Phase 5B Post-MVP)

- Precision Editing Tab:
  - multi-track timeline view
  - frame-accurate scrubbing with timecode
  - split/cut at playhead
  - drag assets into timeline tracks
  - per-track volume/opacity controls (keyframes)
  - keyboard shortcuts
  - undo/redo stack (minimum 50 operations)

### Out of Scope (Phase 5)

- Multi-cam editing
- Color correction and LUT workflows
- Motion tracking, chroma key, advanced compositing FX
- Plugin architecture
- Direct social posting (Phase 6)

## Product Assumptions and Guardrails

Assumptions:

- Most users only need 5A quick-edit controls.
- Users want confidence preview in-browser before rendering final.
- Phase 4 output remains valid even if Phase 5 render fails.

Guardrails:

- Never force editor as mandatory step to export.
- Keep 5A controls opinionated and constrained.
- Prevent destructive mutation of previous successful output.

## Dependencies

### Required Before Start

- Phase 4 assembled output path is stable
- `reel_asset` rows exist for shot clips, voiceover, music, and assembled output
- Job lifecycle and polling contracts from Phase 4 are stable
- Shot metadata source from `generated_content.generatedMetadata.phase4.shots` is available

### Required During Implementation

- Composition persistence decision:
  - `generated_content.generatedMetadata.phase5`, or
  - new `reel_composition` table (recommended)
- Frontend preview strategy chosen and validated for responsiveness
- Render path can consume composition payload deterministically

### Required For Handoff

- Phase 6 metadata/export flows read latest rendered version safely
- Editor metadata does not break existing Phase 4 playback path
- Backward compatibility for users without Phase 5 composition persisted

## MVP Deliverables

1. Composition create/read/update API contract
2. Quick Edit UI shell with responsive desktop/mobile layout
3. Client preview engine for trim/reorder/overlay/caption/transition visualization
4. Server render endpoint for composition-based finalization
5. Render job status and retry UX
6. Version history behavior for fallback and comparison
7. QA and release gates for functional, performance, and ownership safety

## Milestones and Release Slices

### Slice 1: Composition Foundation

- init/load/save contracts
- migration from Phase 4 metadata
- versioning and conflict handling

### Slice 2: Quick Edit 5A End-to-End

- trim/reorder/text/caption/transition controls
- preview parity for supported controls
- autosave and validation UX

### Slice 3: Render Reliability

- render endpoint from composition
- status polling/retry/fallback behavior
- release gate verification

### Slice 4: Precision 5B (Feature Flag)

- timeline lanes and frame tools
- shortcuts and undo/redo depth
- staged rollout after stability metrics pass

## AI-First Product Rules

- `Open Editor` is optional, not forced.
- Defaults preserve current AI output until user edits.
- Re-render happens only when user requests final output.
- Failures preserve prior successful versions and downloadable output.

## Primary Flow

```mermaid
flowchart LR
    phase4Ready[Phase4AssembledVideoReady] --> openEditor[OpenPhase5Editor]
    openEditor --> applyQuickEdits[ApplyTrimReorderTextCaptionTransition]
    applyQuickEdits --> saveComposition[SaveComposition]
    saveComposition --> previewInBrowser[PreviewInBrowser]
    previewInBrowser --> renderFinal[TriggerRenderFinal]
    renderFinal --> pollJob[PollRenderJobStatus]
    pollJob --> outputReady[UpdatedFinalVideoReady]
```

## Definition of Done (Product-Level)

- User can complete full 5A quick-edit pass and render final video in-browser.
- Preview reflects all supported 5A edit types before render.
- Rendered output reflects saved composition deterministically.
- Users can recover from render failures without losing prior successful versions.
- Composition state survives refresh and return sessions.

## Success Metrics (MVP)

- Quick-edit completion rate (`open editor` -> `successful render`) >= 80% for valid inputs
- Render retry recovery rate >= 70%
- Save conflict rate < 2% of save attempts
- p95 autosave response < 800ms
- p95 render job creation response < 2s

## Traceability Checklist (from `docs/REEL_CREATION_TODO.md`)

| Phase 5 Roadmap Item | Covered In |
| --- | --- |
| Client-side video rendering library | `docs/specs/phase5/PHASE5_TECHNICAL_DESIGN.md` |
| Project composition data model | `docs/specs/phase5/PHASE5_TECHNICAL_DESIGN.md` |
| Clip trimmer | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Clip reorder | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Text overlay editor | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Caption style editor | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Transition presets | `docs/specs/phase5/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Preview playback | `docs/specs/phase5/PHASE5_UI_LAYOUT_BLUEPRINT.md` |
| Re-render | `docs/specs/phase5/PHASE5_API_AND_FLOW_CONTRACTS.md` |
| Precision multi-track timeline | `docs/specs/phase5/PHASE5_UI_LAYOUT_BLUEPRINT.md` |
| Frame-accurate scrubbing | `docs/specs/phase5/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Split/cut tool | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Bring-in tool | `docs/specs/phase5/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Per-track volume/opacity | `docs/specs/phase5/PHASE5_TECHNICAL_DESIGN.md` |
| Snap-to-grid/snap-to-beat | `docs/specs/phase5/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Keyboard shortcuts | `docs/specs/phase5/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Undo/redo | `docs/specs/phase5/PHASE5_TECHNICAL_DESIGN.md` |

## Build Sequence

1. Lock composition schema and persistence contract
2. Implement composition CRUD + validation contracts
3. Build Quick Edit UI and preview pipeline
4. Wire `Render Final` and job polling/retry
5. Add versioning/fallback behavior
6. Validate release criteria in `docs/specs/phase5/PHASE5_TEST_AND_RELEASE_CRITERIA.md`
7. Start 5B precision tab behind feature flag after 5A stability
