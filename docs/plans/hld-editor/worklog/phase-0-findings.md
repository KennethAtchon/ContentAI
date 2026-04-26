# Phase 0 Worklog: Findings

> **Phase LLD:** [../00-inventory-contract-freeze.md](../00-inventory-contract-freeze.md)
> **Status:** Working notes

## 2026-04-26 Findings

### F-001: Current Frontend Editor Model Is App-Local And Millisecond-Based

Source: `frontend/src/domains/creation/editor/model/editor-domain.ts`

The current frontend editor model defines `EditProject`, `Track`, `Clip`, and `Transition` independently from `packages/editor-core`. Timeline fields use milliseconds: `startMs`, `durationMs`, `trimStartMs`, `trimEndMs`, and transition `durationMs`.

Implication: Phase 0 must decide a canonical persisted time unit before Phase 2 conversion starts.

### F-002: Current Backend Validation Mirrors The App-Local Track Shape

Source: `backend/src/domain/editor/editor.schemas.ts`

The backend validates `tracks`, `durationMs`, `fps`, and `resolution` directly. The track schema covers `video`, `audio`, `music`, and `text` tracks and validates old app-local clip fields such as `assetId`, `enabled`, `opacity`, `warmth`, `contrast`, `positionX`, `positionY`, `scale`, `rotation`, and placeholder fields.

Implication: the old backend schema is a migration input, not a good target contract. Phase 3 should replace it instead of extending it.

### F-003: Current Database Stores `tracks` As The Main Editor Document

Source: `backend/src/infrastructure/database/drizzle/schema.ts`

`edit_project` currently stores `tracks jsonb`, plus row-level fields such as `duration_ms`, `fps`, `resolution`, `status`, `published_at`, `thumbnail_url`, and `parent_project_id`.

Implication: Phase 1 should move runtime persistence from `tracks` to `project_document`, while preserving relational envelope fields that are useful for auth, listing, lifecycle, and joins.

### F-004: Raw `editor-core Project` Contains Browser/Runtime Fields

Source: `packages/editor-core/src/types/project.ts`

`MediaItem` includes `fileHandle: FileSystemFileHandle | null`, `blob: Blob | null`, and `waveformData: Float32Array | null`. These are runtime/browser fields and are not safe as direct durable JSONB fields.

Implication: the persisted database document should be a JSON-safe serialized project document derived from `editor-core`, not a blind dump of runtime `Project`.

### F-005: `editor-core` Serializer Already Strips Some Runtime Media Fields

Source: `packages/editor-core/src/storage/project-serializer.ts`

`ProjectSerializer.exportToJson()` stores `{ version, project }` and strips media `blob`, `fileHandle`, and `waveformData`. It also uses `SCHEMA_VERSION = "1.0.0"` and has validation for required root fields and missing media references.

Implication: Phase 0 should strongly consider a persisted document root shaped like `{ version, project }`, but still decide whether backend validation lives in `editor-core` or `packages/contracts`.

### F-006: Text And Graphics Have Feature-Specific Core Types

Sources:

- `packages/editor-core/src/text/types.ts`
- `packages/editor-core/src/graphics/types.ts`
- `packages/editor-core/src/types/project.ts`

`Project` includes optional `textClips`, `shapeClips`, `svgClips`, and `stickerClips` arrays in addition to `timeline.tracks`. The old app-local model stores text as a `Track` clip type.

Implication: Phase 0 must decide how current text clips migrate into the core shape and whether timeline clips reference feature-specific arrays by media/clip id.

### F-007: `packages/contracts` Already Hosts Shared Zod Schemas

Source: `packages/contracts/src`

The repo already uses `@contentai/contracts` for shared request/response schemas in domains such as video, customer, admin, payments, and subscription.

Implication: `packages/contracts` is a plausible home for backend/frontend runtime schemas, while `editor-core` remains the source of editor semantics. This needs an explicit Phase 0 decision.
