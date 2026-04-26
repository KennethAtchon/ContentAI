# Phase 0 LLD: Inventory And Contract Freeze

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Freeze the persisted editor contract before schema or runtime work begins.
> **Worklog:** [worklog/phase-0-findings.md](./worklog/phase-0-findings.md)

## 1. Purpose

This phase turns the HLD recommendation into a concrete contract decision. The output is a field-level map from the current editor data model to the target `editor-core` project document and app envelope. No production code paths or database schemas should change in this phase.

## 2. Scope

In scope:

- Inventory current frontend editor fields in `frontend/src/domains/creation/editor/model`.
- Inventory backend editor validation in `backend/src/domain/editor/editor.schemas.ts`.
- Inventory current persistence fields in `backend/src/infrastructure/database/drizzle/schema.ts`.
- Inventory canonical `editor-core` fields in `packages/editor-core/src/types` and `packages/editor-core/src/storage`.
- Decide what belongs in `project_document` versus the relational envelope.
- Decide whether runtime validation lives in `packages/editor-core` or `packages/contracts`.

Out of scope:

- Running migrations.
- Changing API payloads.
- Rewriting frontend runtime behavior.
- Supporting old and new contracts at the same time.

## 3. Inputs

| Source | Why It Matters |
|---|---|
| `frontend/src/domains/creation/editor/model/editor-domain.ts` | Defines current app-local project, track, clip, transition, and UI-adjacent fields. |
| `backend/src/domain/editor/editor.schemas.ts` | Defines current backend autosave and project validation shape. |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Defines current `edit_project` and `export_job` storage. |
| `packages/editor-core/src/types/project.ts` | Defines the target root project vocabulary. |
| `packages/editor-core/src/types/timeline.ts` | Defines target timeline, track, clip, effect, transform, and transition vocabulary. |
| `packages/editor-core/src/storage/project-serializer.ts` | Defines serializer and schema-version expectations. |

## 4. Deliverables

- Worklog findings and decisions captured under [worklog/](./worklog/).
- `current-to-core-field-map.md` or equivalent promoted summary once findings are stable.
- Decision on persisted schema owner:
  - `packages/editor-core` schema
  - `packages/contracts` schema
  - generated schema from core types
- Initial `EditorProjectDocument` contract name and version.
- List of envelope fields derived from the document.
- List of fields intentionally dropped.
- List of fields requiring product/engineering decision.

## 5. Field Classification

Every current field should be classified into exactly one bucket:

| Bucket | Meaning | Examples |
|---|---|---|
| Core document | Required to reproduce the editable video. | timeline tracks, clips, media library, transforms, effects, settings |
| Envelope | Needed for auth, listing, querying, lifecycle, or joins. | `user_id`, `generated_content_id`, `status`, `title`, `thumbnail_url` |
| Derived envelope | Stored relationally but derived from the core document. | `duration_ms`, `fps`, `resolution`, `document_hash` |
| User preference | Editor UI preference, not project content. | layout state, default preset, last-used tab |
| Migration-only | Needed only to convert old data. | old `tracks` JSON shape |
| Dropped | No longer needed after cutover. | obsolete local-only flags that are not persisted semantics |

## 6. Contract Decisions To Make

| Question | Decision Needed |
|---|---|
| What is the exact persisted document root shape? | Decide whether the stored object is raw `Project` or `{ version, project, metadata }`. |
| Are times stored as seconds or milliseconds? | `editor-core` currently uses seconds in several timeline types; current app uses milliseconds. The migration must choose one persisted convention. |
| How are text, graphics, stickers, and virtual clips represented? | Decide whether these live in timeline clips, feature-specific arrays, or both. |
| How are source assets represented? | Decide how `mediaLibrary.items[].id` maps to `assets.id` and `edit_project_asset.media_id`. |
| What schema version is authoritative? | Decide relation between `project_document_version` and `contract_version`. |

## 7. Validation Plan

- Add contract tests that validate representative project documents.
- Add round-trip tests for serialize -> validate -> hydrate.
- Add field-map review checklist before Phase 1 starts.
- Require explicit signoff on dropped fields.

## 8. Exit Criteria

- The canonical persisted document shape is written down.
- Runtime validation ownership is decided.
- Current fields are mapped to core, envelope, preference, migration-only, or dropped.
- Phase 1 schema work can proceed without rediscovering contract boundaries.

## 9. Rollback

No production changes occur in this phase. Rollback is simply to revise the contract document before implementation starts.
