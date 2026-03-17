# Phase 5 In-Browser Editing Suite — Implementation Checklist

## Status: In Progress (Backend complete, Frontend 5A partial)

Phase 5 documentation package is complete and active implementation is underway.  
Backend composition/render foundations are implemented; frontend quick-edit UI is partially implemented.

Remaining items are intentionally split by delivery stage:

- 5A Quick Edit MVP (ship first)
- 5B Precision Editing (ship second, behind quality gates)

**Last updated:** 2026-03-17  
**Purpose:** Track what is built vs remaining for Phase 5 (editing suite). Use with `docs/REEL_CREATION_TODO.md` and `docs/specs/PHASE5_*.md`.

---

## Already implemented (dependencies from earlier phases)

- [x] `reel_asset` registry with media types needed by editor workflows.
- [x] Phase 4 assembled output lifecycle and render job polling baseline.
- [x] Shot metadata baseline (`generatedMetadata.phase4.shots`) available for composition seeding.
- [x] Phase 4 override actions (regenerate/upload/re-assemble) provide editable source foundation.

---

## Backend — Prerequisites and data model

- [x] **Composition persistence schema** — Canonical `reel_composition` storage contract added.  
  Spec: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- [x] **Composition migration initializer** — First-open init path seeds timeline from existing Phase 4/asset state.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [x] **Timeline validation service** — Shared server validator for overlap/ownership/duration constraints.  
  Spec: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- [x] **Version conflict handling** — Optimistic concurrency contract enforced for save and render operations.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`

---

## Backend — Composition and render APIs

- [x] **Init/load composition endpoints** — Create or fetch editable project state.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [x] **Save composition endpoint** — Persist versioned timeline updates.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [x] **Validate endpoint** — Return structured validation issues for UI blocking guidance.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [x] **Render from composition endpoint** — Queue final render from canonical timeline.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [x] **Phase 5 render job status/retry endpoints** — Expose lifecycle and retry path.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`

---

## Frontend — 5A Quick Edit MVP

- [x] **Editor route/shell** — Phase 5 editor route and shell added under studio flow.
- [ ] **Quick tool stack** — Trim/reorder/text/caption/split are implemented; transition preset editing remains.
- [ ] **Preview runtime** — Lightweight timeline/selection preview is implemented; full media-accurate preview remains.
- [x] **Autosave UX** — Debounced autosave with visible save status and retry-safe flow added.
- [x] **Validation UX** — Validation trigger and issue display added in render panel.
- [x] **Render panel** — Render trigger, status polling, and retry flow added.
- [x] **Version list UX** — Rendered versions list is shown in editor render panel.

Specs:

- `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md`
- `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
- `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`

---

## Frontend — 5B Precision Editing (Post-MVP)

- [ ] **Precision tab activation** — Feature-flagged entry and gated rollout.
- [ ] **Multi-track timeline** — Video/audio/text/caption lanes with ruler and playhead.
- [ ] **Frame-accurate scrubbing** — Timecode-synced preview updates.
- [ ] **Split/cut tool** — Keyboard split/delete path exists (`S`, `Delete`), full precision cut UX remains.
- [ ] **Bring-in workflow** — Asset tray drag/drop insertion.
- [ ] **Per-track keyframes** — Volume/opacity keyframe editing.
- [ ] **Snapping behaviors** — Grid, edge, and beat snapping rules.
- [ ] **Keyboard controls** — Implemented subset: `S`, `Delete/Backspace`, undo/redo; transport/timecode keys remain.
- [x] **Undo/redo stack** — 50-entry history with action labels/selection restore is implemented.

Specs:

- `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md`
- `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
- `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`

---

## Quality and release

- [ ] **Contract and integration tests** for composition CRUD, validation, render, retry.
- [ ] **UI tests** for 5A tools, autosave states, and render lifecycle transitions.
- [ ] **Performance verification** against editor load/save/interaction budgets.
- [ ] **Security/ownership verification** across composition and render operations.
- [ ] **Go/no-go gate signoff** per `PHASE5_TEST_AND_RELEASE_CRITERIA`.

Spec: `docs/specs/PHASE5_TEST_AND_RELEASE_CRITERIA.md`

---

## References

- Roadmap source: `docs/REEL_CREATION_TODO.md` (Phase 5 section)
- MVP: `docs/specs/PHASE5_EDITING_SUITE_MVP.md`
- Technical: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- API: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- UI blueprint/state/handoff:
  - `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md`
  - `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
  - `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`
- Tests and release: `docs/specs/PHASE5_TEST_AND_RELEASE_CRITERIA.md`
- Working guide: `docs/specs/PHASE5_MVP_WORKING_GUIDE.md`
