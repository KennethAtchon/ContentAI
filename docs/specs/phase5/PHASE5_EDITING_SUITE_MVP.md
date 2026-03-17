# Phase 5 In-Browser Editing Suite MVP

Last updated: 2026-03-16
Owner: Reel Editor + Media Pipeline
Status: Draft for implementation

## Goal

Ship an optional, browser-native editing layer on top of Phase 4 output so a user can:

- fine-tune AI-generated reels without leaving ContentAI
- preview edits quickly without a full server render loop
- produce an updated final MP4 through a familiar async render flow

Phase 5 must preserve the AI-first product promise: users can publish directly from Phase 4 with no editing required.

## User Outcome

After a reel is assembled in Phase 4, users can:

1. Open the editor
2. Apply quick edits (trim, reorder, text overlays, caption style, transitions)
3. Preview changes in-browser
4. Click `Render Final`
5. Receive a new downloadable MP4 version

Power users can optionally use a precision timeline tab for frame-level operations after 5A is stable.

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
- `Render Final` re-render flow (async job + polling + retry)
- Versioned output behavior that keeps prior assembled output recoverable

### In Scope (Phase 5B Post-MVP)

- Precision Editing Tab:
  - multi-track timeline view
  - frame-accurate scrubbing with timecode
  - split/cut at playhead
  - drag assets into timeline tracks
  - per-track volume/opacity controls (with keyframes)
  - keyboard shortcuts
  - undo/redo stack (minimum 50 operations)

### Out of Scope (Phase 5)

- Multi-cam editing
- Color correction and LUT workflows
- Motion tracking, chroma key, advanced compositing FX
- Plugin architecture
- Direct social posting (Phase 6)

## Dependencies

### Required Before Start

- Phase 4 assembled output path is stable
- `reel_asset` rows exist for shot clips, voiceover, music, and assembled output
- Job lifecycle and polling contracts from Phase 4 are stable
- Shot metadata source from `generated_content.generatedMetadata.phase4.shots` is available

### Required During Implementation

- Final decision on composition persistence location:
  - `generated_content.generatedMetadata.phase5`, or
  - new `reel_composition` table (recommended)
- Frontend preview strategy selected and tested for responsiveness
- Render service path can consume composition payload deterministically

### Required For Handoff

- Phase 6 export/metadata flows read latest rendered version safely
- Editor metadata does not break existing Phase 4 playback path
- Backward compatibility for users with no Phase 5 composition persisted

## MVP Deliverables

1. Composition create/read/update API contract
2. Quick Edit UI shell with responsive desktop/mobile layout
3. Client preview engine for trim/reorder/overlay/caption/transition visualization
4. Server render endpoint for composition-based finalization
5. Render job status and retry UX
6. Version history behavior for fallback and comparison
7. QA and release gates for functional, performance, and ownership safety

## AI-First Product Rules

- `Open Editor` is an optional path, not a forced step after Phase 4 assembly.
- Editor defaults should preserve current AI-generated behavior unless user changes something.
- Re-render should only happen when user explicitly requests final output.
- On failure, keep prior successful outputs playable/downloadable.

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

- User can complete a full 5A quick-edit pass and render a final video without external tools.
- Preview reflects all 5A edit types before render.
- Rendered output reflects composition choices deterministically.
- Users can recover from render failures without losing previous successful versions.
- Composition state survives page refresh and session return.

## Traceability Checklist (from `docs/REEL_CREATION_TODO.md`)

| Phase 5 Roadmap Item | Covered In |
| --- | --- |
| Client-side video rendering library | `docs/specs/PHASE5_TECHNICAL_DESIGN.md` |
| Project composition data model | `docs/specs/PHASE5_TECHNICAL_DESIGN.md` |
| Clip trimmer | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Clip reorder | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Text overlay editor | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Caption style editor | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Transition presets | `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Preview playback | `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md` |
| Re-render | `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md` |
| Precision multi-track timeline | `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md` |
| Frame-accurate scrubbing | `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Split/cut tool | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Bring-in tool | `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md` |
| Per-track volume/opacity | `docs/specs/PHASE5_TECHNICAL_DESIGN.md` |
| Snap-to-grid/snap-to-beat | `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Keyboard shortcuts | `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md` |
| Undo/redo | `docs/specs/PHASE5_TECHNICAL_DESIGN.md` |

## Build Sequence

1. Lock composition schema and persistence contract
2. Implement composition CRUD + validation contracts
3. Build Quick Edit UI and preview pipeline
4. Wire `Render Final` and job polling/retry
5. Add versioning/fallback behaviors
6. Validate release criteria in `docs/specs/PHASE5_TEST_AND_RELEASE_CRITERIA.md`
7. Start 5B precision tab behind feature flag after 5A release stability
