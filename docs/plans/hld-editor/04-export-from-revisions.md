# Phase 4 LLD: Export From Revisions

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Make every export job render an immutable project revision.

## 1. Purpose

Exports must be deterministic. A job should render the exact project document saved at request time, not the mutable latest project row. This phase moves export jobs to `edit_project_revision`.

## 2. Scope

In scope:

- Export revision creation.
- `export_job.project_revision_id`.
- Export settings persistence.
- Worker loading from revisions.
- Export progress/status improvements.

Out of scope:

- Replacing the render engine.
- Redesigning final asset storage.
- UI polish beyond showing status/errors from the new job model.

## 3. Export Request Contract

`POST /api/editor/:id/export` should:

1. Load the current `edit_project.project_document`.
2. Validate the document.
3. Create an immutable `edit_project_revision` with `kind = export`.
4. Insert an `export_job` referencing that revision.
5. Return the job id and revision id.

Example response:

```ts
interface CreateExportResponse {
  jobId: string;
  projectRevisionId: string;
  status: "queued";
}
```

## 4. Export Job Fields

`export_job` should include:

- `edit_project_id`
- `project_revision_id`
- `user_id`
- `status`
- `progress`
- `progress_phase`
- `export_settings`
- `output_asset_id`
- `error`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

## 5. Worker Flow

1. Worker receives or polls job id.
2. Worker loads `export_job`.
3. Worker loads `edit_project_revision.project_document`.
4. Worker resolves project assets from `edit_project_asset` and/or existing asset tables.
5. Worker renders using the canonical document.
6. Worker writes output asset.
7. Worker updates job status and output asset id.

## 6. Important Design Rules

- Export workers must not read mutable `edit_project.project_document` for render input.
- Export requests should not silently render dirty browser state. Product/engineering must decide whether the UI force-saves before export or exports latest acknowledged server state.
- Export settings belong on `export_job`, not inside the project document unless they affect the editable project itself.
- Failed jobs must remain inspectable with the revision and settings that caused the failure.

## 7. Validation

- Creating an export creates exactly one export revision and one job.
- Editing the project after export starts does not change the job's render input.
- Worker can render from revision without loading old `tracks`.
- Job status polling returns queued/rendering/done/failed.
- Output asset links back to the project/export job.

## 8. Exit Criteria

- New export jobs require `project_revision_id`.
- Worker reads revision document only.
- Export settings are persisted with the job.
- Failed jobs are reproducible from revision id plus export settings.

## 9. Rollback

Before release, restore to the previous cutover checkpoint if export validation fails. After release, fix forward on the revision-based path.
