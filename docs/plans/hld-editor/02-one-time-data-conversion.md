# Phase 2 LLD: One-Time Data Conversion

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Skipped — database reset before cutover; no legacy data to convert.
> **Goal:** Convert current editor rows into canonical `editor-core` project documents.

## 1. Purpose

~~This phase builds and validates the one-time conversion from the current `edit_project.tracks` shape into the target canonical project document. The conversion is a cutover prerequisite, not a runtime compatibility layer.~~

**This phase is skipped.** The database was wiped clean before the cutover, so there are no existing `edit_project.tracks` rows to convert. New projects will be written directly in the target canonical document shape. Proceed to Phase 3.

## 2. Scope

In scope:

- Deterministic conversion from current app-local tracks to target project documents.
- Dry-run reporting.
- Initial `cutover_import` revision creation.
- Envelope field derivation.
- Project asset link creation when asset references can be resolved.

Out of scope:

- Supporting old shapes after cutover.
- UI refactors.
- Export worker changes.

## 3. Conversion Inputs

| Input | Source |
|---|---|
| Old tracks | `edit_project.tracks` |
| Project metadata | `edit_project.title`, `duration_ms`, `fps`, `resolution`, `thumbnail_url`, `status` |
| Generated content linkage | `edit_project.generated_content_id` |
| Existing assets | `content_assets`, `assets` |
| Core target types | `packages/editor-core/src/types/project.ts`, `packages/editor-core/src/types/timeline.ts` |

## 4. Conversion Outputs

| Output | Destination |
|---|---|
| Canonical project document | `edit_project.project_document` |
| Document version | `edit_project.project_document_version` |
| Contract version | `edit_project.contract_version` |
| Document hash | `edit_project.document_hash` |
| Save revision | `edit_project.save_revision` |
| Derived metadata | `duration_ms`, `fps`, `resolution` |
| Initial immutable revision | `edit_project_revision(kind = cutover_import)` |
| Asset links | `edit_project_asset` when resolvable |

## 5. Mapping Rules

### 5.1 Project Root

Map current row-level metadata into the target project root:

- `edit_project.id` -> `project.id`
- `edit_project.title` -> `project.name`
- `created_at` / `updated_at` -> `createdAt` / `modifiedAt`
- `fps` / `resolution` -> `project.settings`
- `tracks` -> `project.timeline.tracks`

Decision required: normalize all persisted times to the canonical core convention before writing `project_document`.

### 5.2 Tracks

Map current tracks into `editor-core` tracks:

- Preserve stable track IDs when possible.
- Map current track types into core track types.
- Preserve `muted` and `locked`.
- Derive `hidden` and `solo` defaults if the old model lacks them.
- Map transitions into core transition shape.

### 5.3 Clips

Map current clips into core clips:

- Preserve stable clip IDs.
- Map `assetId` to `mediaId` through the media library.
- Convert start/duration/trim fields into core time units.
- Map visual fields into `transform`.
- Map volume/mute/speed fields into core clip fields.
- Convert text clips into the decided text representation from Phase 0.
- Preserve placeholder state only if it is part of the target contract.

### 5.4 Media Library

Create media library items from referenced assets:

- One `mediaLibrary.items[]` entry per unique source media reference.
- Store durable asset URL/id metadata, not browser-only `Blob` or `FileSystemFileHandle`.
- Create `edit_project_asset` rows linking `media_id` to `assets.id` where possible.
- Record unresolved asset references in the dry-run report.

## 6. Dry-Run Report

The dry-run converter must not mutate data. It should report:

| Metric | Purpose |
|---|---|
| Total projects scanned | Scope of migration. |
| Projects convertible | Go/no-go signal. |
| Projects blocked | Must be fixed or explicitly excluded. |
| Missing assets | Media relinking risk. |
| Unsupported clip types | Contract gap. |
| Time conversion warnings | Unit/rounding risk. |
| Validation errors | Schema correctness risk. |
| Estimated document sizes | JSONB storage risk. |

## 7. Test Fixtures

At minimum:

- Empty/manual project.
- Generated-content project with video clips.
- Project with placeholder clips.
- Project with text clips.
- Project with music and voiceover.
- Published project.
- Snapshot/fork project.
- Project with missing or null asset references.

## 8. Cutover Conversion Steps

1. Take a pre-cutover backup.
2. Run dry-run conversion against the target environment.
3. Confirm zero unexpected blockers.
4. Run the real converter.
5. Validate all written `project_document` values.
6. Create `cutover_import` revisions.
7. Verify row counts and hashes.
8. Hand off to Phase 3 runtime cutover.

## 9. Exit Criteria

- Dry-run reports 100% convertible or explicitly excluded rows.
- Real conversion writes canonical documents for all in-scope projects.
- Initial revisions exist for converted projects.
- Document hashes are stable across repeated dry runs.
- No runtime fallback to old `tracks` is required.

## 10. Rollback

Rollback is restoring the pre-cutover database backup. Failed conversion blocks cutover; it should not be handled by old runtime reads after deployment.
