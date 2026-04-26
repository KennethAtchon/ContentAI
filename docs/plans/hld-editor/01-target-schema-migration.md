# Phase 1 LLD: Target Schema Migration

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Define and apply the target database schema for the clean editor cutover.

## 1. Purpose

This phase designs the target Postgres/Drizzle schema that will replace `edit_project.tracks` as the editor runtime persistence shape. The schema must support canonical project documents, relational envelope fields, immutable revisions, project assets, and revision-based exports.

## 2. Scope

In scope:

- `edit_project` target envelope.
- `edit_project_revision`.
- `edit_project_asset`.
- `export_job` revision linkage.
- Indexes, constraints, and generated/derived fields.
- Backup and restore expectations for the cutover.

Out of scope:

- Data conversion logic.
- Frontend runtime changes.
- Export worker behavior changes beyond schema fields.

## 3. Target Tables

### 3.1 `edit_project`

`edit_project` remains the root project table.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | text | Existing project id. |
| `user_id` | text | Existing ownership field. |
| `title` | text | Listing metadata. |
| `auto_title` | boolean | Existing title behavior. |
| `generated_content_id` | integer nullable | Link to generated content chain. |
| `project_document` | jsonb | Canonical persisted editor document. Required after cutover. |
| `project_document_version` | text | Core serializer/schema version. |
| `contract_version` | text | App/backend contract version if separate from core version. |
| `document_hash` | text | Hash of canonical serialized document. |
| `save_revision` | integer | Monotonic optimistic-concurrency counter. |
| `duration_ms` | integer | Derived envelope field. |
| `fps` | integer | Derived envelope field. |
| `resolution` | text | Derived envelope field. |
| `status` | text | Existing lifecycle field. |
| `published_at` | timestamp nullable | Existing lifecycle field. |
| `user_has_edited` | boolean | Existing lifecycle field. |
| `thumbnail_url` | text nullable | Listing metadata. |
| `parent_project_id` | text nullable | Keep only if snapshots/forks still use project rows. |
| `created_at` | timestamp | Existing lifecycle field. |
| `updated_at` | timestamp | Existing lifecycle field. |

Decision point: either drop `tracks` in this migration or retain it as a non-runtime backup column until Phase 6. Runtime code must not read or write it after Phase 3.

### 3.2 `edit_project_revision`

Stores immutable project documents for cutover import, snapshots, publish checkpoints, and exports.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | text | UUID or equivalent. |
| `project_id` | text | FK to `edit_project.id`. |
| `user_id` | text | FK to `users.id`, copied for ownership lookup. |
| `revision_number` | integer | Unique per project. |
| `kind` | text | `cutover_import`, `manual_snapshot`, `publish`, `export`, `autosave`. |
| `project_document` | jsonb | Immutable document. |
| `project_document_version` | text | Version used to validate this revision. |
| `contract_version` | text | App/backend contract version. |
| `document_hash` | text | Hash of immutable document. |
| `source_revision_id` | text nullable | Optional lineage. |
| `created_at` | timestamp | Revision creation time. |

Suggested constraints:

- Unique `(project_id, revision_number)`.
- Index `(project_id, created_at)`.
- Index `(user_id, created_at)`.
- Optional unique `(project_id, document_hash, kind)` if idempotency is useful.

### 3.3 `edit_project_asset`

Links project-level media IDs to stored assets.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `project_id` | text | FK to `edit_project.id`. |
| `asset_id` | text | FK to `assets.id`. |
| `user_id` | text | Ownership lookup. |
| `media_id` | text | `editor-core` media library ID. |
| `role` | text | `source_video`, `voiceover`, `music`, `image`, `thumbnail`, `proxy`, `export_output`. |
| `source` | text | `generated_content`, `user_upload`, `system`, `export`. |
| `generated_content_id` | integer nullable | Source content if applicable. |
| `metadata` | jsonb nullable | Waveform/proxy/thumbnail hints. |
| `created_at` | timestamp | Link creation time. |

Suggested constraints:

- Unique `(project_id, media_id)` for source media references.
- Index `(project_id, role)`.
- Index `(asset_id)`.
- Index `(generated_content_id)` when present.

### 3.4 `export_job`

Add revision provenance to existing export jobs.

Required additions:

| Field | Type | Notes |
|---|---|---|
| `project_revision_id` | text | FK to `edit_project_revision.id`. Required for new jobs. |
| `export_settings` | jsonb | Resolution/fps/format/quality settings used. |
| `started_at` | timestamp nullable | Operational visibility. |
| `completed_at` | timestamp nullable | Operational visibility. |
| `progress_phase` | text nullable | Better UI/debug status than percent alone. |

## 4. Migration Design

The Drizzle migration should be target-schema-first. It should not attempt to support both old and new runtime shapes indefinitely.

Implementation choices to decide before writing the migration:

- Whether `project_document` is nullable for the schema migration and made non-null after conversion.
- Whether `tracks` is dropped immediately or kept as backup data until Phase 6.
- Whether `edit_project_revision.project_document` needs JSONB check constraints or only application validation.
- Whether `save_revision` starts at `1` after cutover import or preserves a derived existing value.

## 5. Validation

- Drizzle migration compiles.
- Local migration applies to an empty database.
- Local migration applies to a database with representative existing editor rows.
- Indexes match expected query paths:
  - project list by user/status
  - project revisions by project
  - export jobs by project/user/status
  - project assets by project/role

## 6. Exit Criteria

- Target schema migration is reviewed.
- Backup/restore procedure for cutover is documented.
- Phase 2 has enough schema surface to write converted documents and initial revisions.

## 7. Rollback

Before release, rollback is restoring the pre-migration database backup and redeploying the previous app. After release, fix forward unless data integrity requires restoring a backup.
