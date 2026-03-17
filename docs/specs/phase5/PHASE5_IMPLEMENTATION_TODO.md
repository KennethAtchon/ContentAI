# Phase 5 In-Browser Editing Suite — Implementation Checklist

## Status: Planning Complete, Implementation Not Started

Phase 5 documentation package is complete and implementation-ready.  
No engineering tasks are marked complete yet for this phase.

Remaining items are intentionally split by delivery stage:

- 5A Quick Edit MVP (ship first)
- 5B Precision Editing (ship second, behind quality gates)

**Last updated:** 2026-03-16  
**Purpose:** Track what is built vs remaining for Phase 5 (editing suite). Use with `docs/REEL_CREATION_TODO.md` and `docs/specs/PHASE5_*.md`.

---

## Already implemented (dependencies from earlier phases)

- [x] `reel_asset` registry with media types needed by editor workflows.
- [x] Phase 4 assembled output lifecycle and render job polling baseline.
- [x] Shot metadata baseline (`generatedMetadata.phase4.shots`) available for composition seeding.
- [x] Phase 4 override actions (regenerate/upload/re-assemble) provide editable source foundation.

---

## Backend — Prerequisites and data model

- [ ] **Composition persistence schema** — Add canonical `reel_composition` storage contract.  
  Spec: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- [ ] **Composition migration initializer** — First-open migration from Phase 4 metadata to composition timeline.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [ ] **Timeline validation service** — Shared server validator for overlaps, ownership, and duration constraints.  
  Spec: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- [ ] **Version conflict handling** — Optimistic concurrency contract for save and render operations.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`

---

## Backend — Composition and render APIs

- [ ] **Init/load composition endpoints** — Create or fetch editable project state.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [ ] **Save composition endpoint** — Persist versioned timeline updates.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [ ] **Validate endpoint** — Return structured validation issues for UI blocking guidance.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [ ] **Render from composition endpoint** — Queue final render from canonical timeline.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- [ ] **Phase 5 render job status/retry endpoints** — Expose lifecycle and retry path.  
  Spec: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`

---

## Frontend — 5A Quick Edit MVP

- [ ] **Editor route/shell** — Add Phase 5 editor entry route and workspace shell.
- [ ] **Quick tool stack** — Trim, reorder, text overlay, caption style, transition presets.
- [ ] **Preview runtime** — In-browser preview updates from local composition edits.
- [ ] **Autosave UX** — Debounced save with visible state and retry behavior.
- [ ] **Validation UX** — Surface blocking issues with actionable guidance.
- [ ] **Render panel** — Trigger render, poll status, retry failures.
- [ ] **Version list UX** — Show latest output and preserve fallback to prior successful versions.

Specs:

- `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md`
- `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
- `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`

---

## Frontend — 5B Precision Editing (Post-MVP)

- [ ] **Precision tab activation** — Feature-flagged entry and gated rollout.
- [ ] **Multi-track timeline** — Video/audio/text/caption lanes with ruler and playhead.
- [ ] **Frame-accurate scrubbing** — Timecode-synced preview updates.
- [ ] **Split/cut tool** — Segment split and delete operations.
- [ ] **Bring-in workflow** — Asset tray drag/drop insertion.
- [ ] **Per-track keyframes** — Volume/opacity keyframe editing.
- [ ] **Snapping behaviors** — Grid, edge, and beat snapping rules.
- [ ] **Keyboard controls** — Space, J/K/L, I/O, S, Delete, undo shortcuts.
- [ ] **Undo/redo stack** — Minimum 50 levels with deterministic behavior.

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
