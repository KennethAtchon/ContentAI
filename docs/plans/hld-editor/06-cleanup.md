# Phase 6 LLD: Cleanup

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Remove old editor persistence and runtime scaffolding after the clean cutover is validated.

## 1. Purpose

This phase removes the migration scaffolding and old editor model pieces that are no longer part of the architecture. It should happen only after the clean cutover has been validated with real converted projects.

## 2. Scope

In scope:

- Dropping or archiving old `tracks` storage if retained during cutover.
- Removing old backend schemas and route payloads.
- Removing old frontend app-local runtime model usage.
- Removing converter-only code after retention requirements are met.
- Updating docs and TODOs.

Out of scope:

- New editor features.
- New schema redesign.
- Production cleanup without backup verification.

## 3. Cleanup Checklist

### 3.1 Database

- Drop `edit_project.tracks` if retained as a temporary backup column.
- Remove obsolete indexes tied only to old runtime fields.
- Confirm `project_document` is required for all active projects.
- Confirm new export jobs require `project_revision_id`.

### 3.2 Backend

- Remove old `tracks` patch schemas.
- Remove old parse/validate helpers that only support `edit_project.tracks`.
- Remove repository methods that read/write old `tracks`.
- Keep only canonical document validation and serializer boundaries.
- Update backend tests to use canonical fixtures.

### 3.3 Frontend

- Remove old app-local editor model fields that are not envelope/UI state.
- Remove old timeline mutation helpers replaced by `editor-core`.
- Remove old API client shapes that expect top-level `tracks`.
- Update fixtures/mocks to canonical project documents.

### 3.4 Docs

- Update [../hld-editor.md](../hld-editor.md) if decisions changed during implementation.
- Update this LLD folder with final decisions.
- Add post-cutover notes: what was removed, what remains, and known follow-up work.

## 4. Retention Decisions

Before deleting conversion artifacts, decide:

| Artifact | Decision Needed |
|---|---|
| Pre-cutover database backup | Retention period and owner. |
| Dry-run reports | Whether to keep in internal docs or build artifacts. |
| Converter script | Delete, archive, or keep as historical migration tool. |
| Old fixture data | Delete or convert to canonical fixtures. |

## 5. Validation

- Full test suite passes.
- `rg "tracks"` confirms remaining references are either core timeline tracks or historical docs, not old `edit_project.tracks` runtime code.
- New project creation creates canonical documents.
- Existing converted projects open/save/export.
- Export jobs reference revisions.

## 6. Exit Criteria

- Old runtime persistence path is gone.
- Temporary migration code is removed or explicitly archived.
- Documentation reflects the final architecture.
- No known production path requires the old app-local `tracks` contract.

## 7. Rollback

Dropping old columns and deleting migration scaffolding is destructive. Rollback requires restoring from backup. Do this phase only after cutover validation and backup retention are confirmed.
