# Phase 1 LLD: Target Schema Migration

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Worklog:** [worklog/phase-1-findings.md](./worklog/phase-1-findings.md)
> **Status:** Draft
> **Goal:** Define and apply the target database schema for the clean editor cutover.

## 1. Purpose

This phase designs the target Postgres/Drizzle schema that will replace `edit_project.tracks` as the editor runtime persistence shape. The schema must support canonical project documents, relational envelope fields, immutable revisions, project assets, derived artifacts, and revision-based exports.

This is a clean migration. Runtime code after cutover should use the new schema only; no backwards-compatible dual-read or indefinite legacy-write path is required.

## 2. Research Summary

Phase 1 has to account for the low-level surfaces already present in `editor-core`, not only the obvious timeline fields.

Schema ownership follows [D-003](./worklog/decision-log.md): editor-specific runtime and persisted document schemas belong in `packages/editor-core`; broader non-editor API contracts remain in `packages/contracts`. The database stores and indexes the project envelope, revisions, assets, artifacts, and export provenance around that editor-owned document.

| Surface | Storage decision | Rationale |
|---|---|---|
| Timeline, tracks, clips, transitions, effects, keyframes, markers, text, graphics, stickers | `edit_project.project_document` and `edit_project_revision.project_document` | These are the editable project state and need one canonical serialized document. |
| Subtitles generated from voiceover | Editable subtitles live in `project_document.timeline.subtitles`; raw transcript/provenance can live in `edit_project_artifact` | `editor-core` already models subtitles as timeline data. Generated captions become user-editable once inserted. |
| Source media, generated media, thumbnails, proxies, waveforms, filmstrips, sidecar files, export outputs | `edit_project_asset` links to stored `assets` rows | Binary/file-backed resources need relational ownership, lookup, and lifecycle management outside the JSON document. |
| Built-in filter, particle, subtitle style, template, export, and social presets | Keep in `editor-core` code catalogs; store applied preset IDs/versions or expanded settings in the project document/export settings | Built-ins are versioned application code, not user data. |
| User/admin presets or templates | Defer to optional `editor_catalog_item` only if product requirements need managed catalogs | Do not add product-data tables for built-ins during this cutover. |
| WGSL/WebGL shaders, WASM helpers, render pipeline code | No DB rows; store renderer/editor-core version on revisions and export jobs | Shaders and WASM modules are renderer code/runtime artifacts, not project data. |
| Frame caches, decoded frame handles, local file handles, device benchmarks, capability probes | No server project schema | These are runtime/client-local performance details. Export jobs may store a compact capability snapshot for debugging. |
| Transcript, subtitle generation, waveform manifest, beat analysis, render manifest, migration report | `edit_project_artifact` when the data is useful but not canonical editable document state | Derived artifacts need provenance and regeneration/audit hooks without bloating the core document envelope. |

Primary local references:

- `packages/editor-core/src/types/timeline.ts`
- `packages/editor-core/src/types/project.ts`
- `packages/editor-core/src/media/types.ts`
- `packages/editor-core/src/storage/types.ts`
- `packages/editor-core/src/text/subtitle-engine.ts`
- `packages/editor-core/src/text/transcription-service.ts`
- `packages/editor-core/src/video/shaders/README.md`
- `packages/editor-core/src/video/upscaling/README.md`
- `packages/editor-core/src/video/filter-presets.ts`
- `packages/editor-core/src/effects/particle-presets.ts`
- `packages/editor-core/src/template/template-engine.ts`
- `packages/editor-core/src/export/types.ts`

External references:

- PostgreSQL JSONB guidance: https://www.postgresql.org/docs/current/datatype-json.html
- W3C WGSL shader lifecycle: https://www.w3.org/TR/WGSL/#shader-lifecycle
- W3C WebVTT cue model: https://www.w3.org/TR/webvtt1/#webvtt-cues
- OpenTimelineIO timeline/media reference model: https://opentimelineio.readthedocs.io/en/v0.16.0/tutorials/otio-timeline-structure.html

## 3. Scope

In scope:

- `edit_project` target envelope.
- `edit_project_revision`.
- `edit_project_asset`.
- `edit_project_artifact`.
- `export_job` revision and renderer provenance linkage.
- Catalog/preset storage decision for built-ins versus user/admin-managed presets.
- Indexes, constraints, and generated/derived fields.
- Backup and restore expectations for the clean cutover.

Out of scope:

- Data conversion logic.
- Frontend runtime changes.
- Export worker behavior changes beyond schema fields.
- DB tables for bundled shaders, built-in presets, frame caches, decoded frame buffers, local file handles, client benchmarks, or WebGPU/WebGL pipeline objects.
- Backwards-compatible dual persistence after the cutover.

## 4. Target Tables

### 4.1 `edit_project`

`edit_project` remains the root project table and owns the latest editable document.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | text | Existing project id. |
| `user_id` | text | Existing ownership field. |
| `title` | text | Listing metadata. |
| `auto_title` | boolean | Existing title behavior. |
| `generated_content_id` | integer nullable | Link to generated content chain. |
| `project_document` | jsonb | Canonical persisted editor document. Required after cutover. |
| `project_document_version` | text | `editor-core` serializer/schema version. |
| `contract_version` | text | App/backend contract version if separate from core version. |
| `editor_core_version` | text | Package/build version used to write the current document. |
| `document_hash` | text | Hash of canonical serialized document. |
| `save_revision` | integer | Monotonic optimistic-concurrency counter. |
| `last_saved_revision_id` | text nullable | FK to latest durable revision when one exists. |
| `duration_ms` | integer | Derived envelope field for listing/query. |
| `fps` | integer | Derived envelope field for listing/query. |
| `resolution` | text | Derived envelope field, for example `1920x1080`. |
| `status` | text | Existing lifecycle field. |
| `published_at` | timestamp nullable | Existing lifecycle field. |
| `user_has_edited` | boolean | Existing lifecycle field. |
| `thumbnail_url` | text nullable | Listing metadata. Prefer an `edit_project_asset` thumbnail link when available. |
| `parent_project_id` | text nullable | Keep only if snapshots/forks still use project rows. |
| `created_at` | timestamp | Existing lifecycle field. |
| `updated_at` | timestamp | Existing lifecycle field. |

Document shape expectations:

- `project_document` contains the editable editor state: timeline, tracks, clips, effects, transitions, keyframes, markers, subtitles, applied preset references/settings, template application metadata, media library references, and editor-level metadata needed to reopen the project.
- It should not contain large binary payloads, generated file bytes, frame caches, local file handles, shader source, compiled pipeline state, or device benchmark results.
- JSONB is correct for this canonical document because the backend needs to persist and validate the whole editor state, while hot list/query fields remain relational.

Cutover decision:

- Drop or ignore `tracks` as a runtime column in this migration. Keeping a short-lived backup column is acceptable only for operational restore, not as an application read path.

### 4.2 `edit_project_revision`

Stores immutable project documents for cutover import, manual snapshots, publish checkpoints, autosave checkpoints, and exports.

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
| `editor_core_version` | text | Package/build version used to serialize this revision. |
| `renderer_version` | text nullable | Renderer/shader bundle version if different from `editor_core_version`. |
| `document_hash` | text | Hash of immutable canonical document. |
| `source_revision_id` | text nullable | Optional lineage. |
| `created_at` | timestamp | Revision creation time. |

Suggested constraints:

- Unique `(project_id, revision_number)`.
- Index `(project_id, created_at)`.
- Index `(user_id, created_at)`.
- Optional unique `(project_id, document_hash, kind)` if idempotency is useful.

### 4.3 `edit_project_asset`

Links project-level media IDs and generated outputs to stored assets.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `project_id` | text | FK to `edit_project.id`. |
| `asset_id` | text | FK to `assets.id`. |
| `user_id` | text | Ownership lookup. |
| `media_id` | text nullable | `editor-core` media library ID when this asset is addressable from the project document. |
| `revision_id` | text nullable | FK to `edit_project_revision.id` when the asset is revision-specific. |
| `role` | text | See allowed role set below. |
| `source` | text | `generated_content`, `user_upload`, `system`, `export`, `derived`, `migration`. |
| `generated_content_id` | integer nullable | Source content if applicable. |
| `metadata` | jsonb nullable | Duration, dimensions, waveform hints, proxy profile, filmstrip layout, source URL hashes, etc. |
| `created_at` | timestamp | Link creation time. |

Allowed `role` values:

- `source_video`
- `source_audio`
- `source_image`
- `voiceover`
- `music`
- `thumbnail`
- `proxy`
- `waveform`
- `filmstrip_thumbnail`
- `subtitle_sidecar`
- `transcript_source`
- `export_output`

Suggested constraints:

- Unique `(project_id, media_id)` where `media_id is not null` and the role is source-like.
- Index `(project_id, role)`.
- Index `(project_id, revision_id)`.
- Index `(asset_id)`.
- Index `(generated_content_id)` when present.

### 4.4 `edit_project_artifact`

Stores non-canonical derived data and provenance that is useful to keep but should not be treated as editable project document state.

Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | text | UUID or equivalent. |
| `project_id` | text | FK to `edit_project.id`. |
| `user_id` | text | Ownership lookup. |
| `revision_id` | text nullable | FK to the revision this artifact was produced from. |
| `source_media_id` | text nullable | `editor-core` media ID used as source input. |
| `asset_id` | text nullable | FK to `assets.id` when the artifact has file-backed output. |
| `kind` | text | See allowed kind set below. |
| `status` | text | `pending`, `ready`, `failed`, `stale`. |
| `provider` | text nullable | For example transcription provider, renderer, or analysis engine. |
| `data` | jsonb | Small structured payload or manifest. Large files stay in `assets`. |
| `data_hash` | text nullable | Hash of canonical artifact data or manifest. |
| `created_at` | timestamp | Creation time. |
| `updated_at` | timestamp | Last status/data update time. |

Allowed `kind` values:

- `transcript`
- `subtitle_generation`
- `waveform_manifest`
- `beat_analysis`
- `render_manifest`
- `migration_report`

Usage rules:

- Editable subtitles generated from voiceover are stored in `project_document.timeline.subtitles`.
- Raw transcription response, word-level timings, prompt/provider settings, confidence scores, or regeneration provenance can be stored as `transcript` or `subtitle_generation` artifacts.
- Waveform and filmstrip binary outputs should be `edit_project_asset` links. Their compact manifests can be `edit_project_artifact` rows when the data is needed outside the asset metadata.
- Beat analysis can be an artifact until the user applies beats to editable markers/cuts, at which point the chosen edits belong in the project document.

Suggested constraints:

- Index `(project_id, kind, status)`.
- Index `(project_id, revision_id)`.
- Index `(source_media_id)`.
- Index `(asset_id)` when present.

### 4.5 `export_job`

Add revision, settings, output, and renderer provenance to existing export jobs.

Required additions:

| Field | Type | Notes |
|---|---|---|
| `project_revision_id` | text | FK to `edit_project_revision.id`. Required for new jobs. |
| `output_asset_id` | text nullable | FK to `assets.id` for completed export output. |
| `export_settings` | jsonb | Resolution, fps, format, codec, bitrate, quality, captions, audio, and preset settings used. |
| `input_document_hash` | text | Hash of the revision document rendered. |
| `editor_core_version` | text | Version used to interpret the document. |
| `renderer_version` | text | Renderer/shader bundle version used by the export path. |
| `worker_version` | text nullable | Backend/worker build SHA or package version. |
| `capability_snapshot` | jsonb nullable | Compact debug snapshot only, not a full device benchmark table. |
| `error_details` | jsonb nullable | Structured failure details. |
| `started_at` | timestamp nullable | Operational visibility. |
| `completed_at` | timestamp nullable | Operational visibility. |
| `progress_phase` | text nullable | Better UI/debug status than percent alone. |

Suggested constraints:

- Index `(project_revision_id)`.
- Index `(output_asset_id)` when present.
- Index `(user_id, status, created_at)` if the existing table does not already cover export lists.

### 4.6 Optional Future: `editor_catalog_item`

Do not add this table for built-in presets during the clean migration. Add it only if v1 product requirements include user/admin-managed templates or presets.

Potential fields if needed later:

| Field | Type | Notes |
|---|---|---|
| `id` | text | UUID or equivalent. |
| `scope` | text | `system`, `user`, `workspace`. |
| `type` | text | `filter_preset`, `particle_preset`, `subtitle_style`, `export_preset`, `template`, `sticker_pack`. |
| `owner_user_id` | text nullable | Required for user-scoped items. |
| `name` | text | Display name. |
| `version` | text | Catalog item version. |
| `data` | jsonb | Preset/template payload. |
| `is_active` | boolean | Soft disable. |
| `created_at` | timestamp | Creation time. |
| `updated_at` | timestamp | Last update time. |

## 5. Migration Design

The Drizzle migration should be target-schema-first. It should not attempt to support both old and new runtime shapes indefinitely.

Implementation choices to decide before writing the migration:

- Whether `project_document` is nullable for the schema migration and made non-null after conversion.
- Whether `tracks` is dropped immediately or kept as operational backup data until the cutover is verified.
- Whether `edit_project_revision.project_document` needs database-level JSONB check constraints or only application validation.
- Whether `save_revision` starts at `1` after cutover import or preserves a derived existing value.
- Whether `edit_project_artifact` is created in Phase 1 even if Phase 2 only populates migration reports at first.
- Whether sidecar caption exports (`.srt` or `.vtt`) are persisted as `subtitle_sidecar` assets at export time or generated on demand from `project_document.timeline.subtitles`.
- Whether renderer provenance is recorded as package version, build SHA, or both.

Recommended sequencing:

1. Add new columns/tables as nullable where conversion needs a staging window.
2. Create indexes and constraints that do not depend on converted data.
3. Run Phase 2 conversion into `project_document`, initial `edit_project_revision`, `edit_project_asset`, and any required `edit_project_artifact` rows.
4. Add non-null constraints after converted rows pass validation.
5. Remove or quarantine legacy `tracks` runtime access during Phase 3.

## 6. Validation

- Drizzle migration compiles.
- Local migration applies to an empty database.
- Local migration applies to a database with representative existing editor rows.
- Converted project rows have non-null `project_document`, `project_document_version`, `editor_core_version`, `document_hash`, and `save_revision`.
- Every converted project has an initial `cutover_import` revision.
- Source media and generated media references in `project_document` have corresponding `edit_project_asset` rows when they point to stored assets.
- Voiceover-generated subtitles round-trip as editable `project_document.timeline.subtitles`.
- Raw transcription/provenance is either intentionally discarded or captured in `edit_project_artifact`.
- Built-in presets/templates do not create DB rows; applied preset references/settings survive in the project document or export settings.
- No shader, frame-cache, local-file-handle, or device-benchmark data is stored in project tables.
- Indexes match expected query paths:
  - project list by user/status
  - project revisions by project
  - export jobs by project/user/status
  - project assets by project/role
  - project artifacts by project/kind/status

## 7. Exit Criteria

- Target schema migration is reviewed against `editor-core` timeline, media, subtitle, template, preset, shader, storage, device, and export surfaces.
- Backup/restore procedure for cutover is documented.
- Preset/catalog policy is recorded: built-ins stay in code; user/admin catalog is optional future schema.
- Subtitle policy is recorded: editable subtitles in the project document; raw transcript/provenance in artifacts only when needed.
- Phase 2 has enough schema surface to write converted documents, initial revisions, asset links, and migration artifacts.

## 8. Rollback

Before release, rollback is restoring the pre-migration database backup and redeploying the previous app. After release, fix forward unless data integrity requires restoring a backup.
