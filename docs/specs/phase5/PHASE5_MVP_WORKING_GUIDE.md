# Phase 5 MVP Working Guide

This guide explains how to work with the current Phase 5 implementation target and how to validate day-to-day progress while building the in-browser editing suite.

Use this together with `docs/specs/PHASE5_IMPLEMENTATION_TODO.md`.

---

## 1) What "Phase 5 MVP" means

Phase 5 MVP refers to **5A Quick Edit** only:

- composition initialize/load/save
- clip trim and reorder
- text overlay and caption style edits
- transition presets
- in-browser preview
- final re-render with retry

Precision timeline controls (5B) are explicitly post-MVP.

---

## 2) Primary developer verification flow

1. Open a generated content item that has completed Phase 4 assembly.
2. Open Phase 5 editor route.
3. Confirm composition initializes from Phase 4 data (first open) or loads existing composition.
4. Apply one edit from each quick tool category:
   - trim
   - reorder
   - text overlay
   - caption style
   - transition preset
5. Confirm preview updates without server render.
6. Confirm autosave status transitions (`saving` -> `saved`).
7. Trigger `Render Final`.
8. Poll job status to completion.
9. Verify updated output plays and previous version remains recoverable.

---

## 3) Key controls and expected behavior

- `Open Editor`: enters optional Phase 5 flow; does not invalidate Phase 4 output.
- `Autosave`: debounced persistence of composition changes.
- `Render Final`: submits current composition version to async render pipeline.
- `Retry Render`: creates new job without discarding composition state.
- `Version switch/open`: compare or restore to known-good output.

If save or render fails, user should never lose previously saved composition or previous successful output.

---

## 4) Operational guardrails

- Keep AI-first behavior: editor is optional, never mandatory for publish flow.
- Keep schema evolution additive; avoid breaking existing composition reads.
- Validate timeline server-side before accepting render jobs.
- Preserve backward compatibility for users who never open Phase 5.
- Do not persist signed URLs in composition data.

---

## 5) Suggested implementation order

1. Composition schema + migration initializer
2. Composition APIs + timeline validation
3. Editor shell + quick tools
4. Preview runtime + autosave UX
5. Render panel + polling + retry
6. Release criteria validation
7. Precision mode feature flag and staged rollout

---

## 6) Common pitfalls and recovery

- **Pitfall:** stale version conflicts from multiple tabs  
  **Recovery:** use version conflict modal and reload latest state.

- **Pitfall:** timeline invalid after drag/reorder edge cases  
  **Recovery:** run validation endpoint and focus problematic items.

- **Pitfall:** render failure due to transition edge constraints  
  **Recovery:** keep composition intact, surface issue, retry after fix.

- **Pitfall:** unsaved local edits during network drop  
  **Recovery:** keep local dirty snapshot and retry save.

---

## 7) Quick manual checklist

- Editor loads in < 3 seconds for existing composition.
- Each quick-edit control updates preview correctly.
- Save state is visible and accurate.
- Validation issues block render only when truly invalid.
- Render flow reaches completed output with downloadable URL.
- Render retry works and prior successful output remains available.

---

## 8) Source of truth

- Phase 5 checklist: `docs/specs/PHASE5_IMPLEMENTATION_TODO.md`
- Product scope: `docs/specs/PHASE5_EDITING_SUITE_MVP.md`
- Technical contract: `docs/specs/PHASE5_TECHNICAL_DESIGN.md`
- API contract: `docs/specs/PHASE5_API_AND_FLOW_CONTRACTS.md`
- UI contract set:
  - `docs/specs/PHASE5_UI_LAYOUT_BLUEPRINT.md`
  - `docs/specs/PHASE5_UI_STATES_AND_WIREFLOWS.md`
  - `docs/specs/PHASE5_UI_IMPLEMENTATION_HANDOFF.md`
- Test/release criteria: `docs/specs/PHASE5_TEST_AND_RELEASE_CRITERIA.md`
