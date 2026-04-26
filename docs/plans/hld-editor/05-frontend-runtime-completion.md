# Phase 5 LLD: Frontend Runtime Completion

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Finish moving editor runtime behavior through the bridge and `editor-core`.

## 1. Purpose

After backend cutover, the frontend still needs to finish removing app-local timeline ownership. This phase completes the runtime architecture: React renders UI, the bridge manages lifecycle/integration, and `editor-core` owns editor rules.

## 2. Scope

In scope:

- Editor bridge structure.
- Core hydration and serialization.
- Timeline mutations through core actions.
- Inspector updates through core actions.
- Playback integration.
- Autosave and export commands through the bridge.
- Removal of duplicated frontend timeline mutation logic.

Out of scope:

- Major visual redesign.
- New AI editing features.
- Collaboration/offline sync.

## 3. Proposed Frontend Ownership

| Layer | Owns |
|---|---|
| React UI | Layout, selection display, panels, forms, drag handles, status display. |
| Editor bridge | Core lifecycle, API load/save/export, debouncing, revision tracking, asset relinking. |
| `editor-core` | Project state, timeline rules, actions, playback vocabulary, serialization. |
| App state | Auth/session, route state, global notifications, non-editor app metadata. |

## 4. Candidate Bridge Modules

| Module | Responsibility |
|---|---|
| `project-bridge` | Load, hydrate, serialize, save project documents. |
| `timeline-bridge` | Expose timeline commands backed by core actions. |
| `playback-bridge` | Connect preview controls to core playback. |
| `asset-bridge` | Resolve uploads/generated assets into core media library entries. |
| `export-bridge` | Create export jobs and poll status. |
| `selection-bridge` | Keep UI selection separate from persisted document state. |

Exact filenames can follow repo conventions, but the ownership boundary should stay explicit.

## 5. UI Migration Targets

Review and migrate editor surfaces under `frontend/src/domains/creation/editor/ui`:

- layout/header/status bar
- timeline section
- timeline clips and transitions
- inspector tabs
- preview area and playback controls
- export modal
- left panel assets/content

Each surface should stop assuming the old `EditProject.tracks` shape and instead consume bridge-provided view state or commands.

## 6. State Rules

- Persisted project state lives in `editor-core` project state.
- UI-only state stays out of `project_document`.
- App envelope fields are displayed from API metadata, not embedded into core document semantics.
- Autosave serializes through one bridge boundary.
- Export requests go through the export bridge and use latest acknowledged server state or an explicit force-save flow.

## 7. Validation

- Editor opens a converted project.
- Timeline edits apply through core actions.
- Inspector edits apply through core actions.
- Playback controls use core playback abstractions.
- Autosave sends canonical documents only.
- Export command uses revision-based backend route.
- No UI code imports old app-local timeline mutation helpers for runtime behavior.

## 8. Exit Criteria

- Frontend runtime no longer depends on the old `EditProject.tracks` model.
- Bridge modules are the only API/core integration boundary.
- React components are mostly presentation plus command dispatch.
- Save/export/open flows pass integration tests or manual QA checklist.

## 9. Rollback

Before release, rollback is restoring the pre-cutover app/database pair. After release, fix forward; do not reintroduce the old editor model as a supported path.
