# Phase 1 Worklog: Target Schema Findings

> **Phase LLD:** [../01-target-schema-migration.md](../01-target-schema-migration.md)
> **Status:** Working notes

## 2026-04-26 Findings

### F1-001: Shaders Are Renderer Code, Not Project Data

Sources:

- `packages/editor-core/src/video/shaders/README.md`
- `packages/editor-core/src/video/shaders/index.ts`
- W3C WGSL shader lifecycle: https://www.w3.org/TR/WGSL/#shader-lifecycle

`editor-core` ships WGSL shader source as code assets consumed by WebGPU renderer modules. The WGSL spec describes shader modules and pipelines as runtime GPU preparation/execution artifacts, not project document data.

Implication: do not add DB tables for bundled shader source. Store renderer/shader package version on export jobs/revisions only when needed for reproducibility.

### F1-002: Built-In Presets Are Code Catalogs; User/Admin Presets Are Product Data

Sources:

- `packages/editor-core/src/video/filter-presets.ts`
- `packages/editor-core/src/effects/particle-presets.ts`
- `packages/editor-core/src/text/subtitle-engine.ts`
- `packages/editor-core/src/template/template-engine.ts`
- `packages/editor-core/src/export/types.ts`

Filter presets, particle presets, subtitle style presets, export quality presets, social media presets, and built-in templates currently live as TypeScript constants in `editor-core`.

Implication: built-in presets should not require DB rows for the clean migration. If users or admins can create/share/override presets, add a separate catalog table later. Persist applied preset IDs/versions or expanded effect settings in `project_document`.

### F1-003: Subtitles Are Editable Timeline Data

Sources:

- `packages/editor-core/src/types/timeline.ts`
- `packages/editor-core/src/text/transcription-service.ts`
- W3C WebVTT cue model: https://www.w3.org/TR/webvtt1/#webvtt-cues

`Timeline` already has `subtitles: Subtitle[]`. `TranscriptionService` converts speech/Whisper responses into `Subtitle[]`, and WebVTT models timed text as cues with text and timing.

Implication: subtitles generated from voiceover belong in `project_document.timeline.subtitles` once they are editable. Raw transcript/provider metadata can be stored separately as a derived artifact if needed for audit/regeneration.

### F1-004: Media References Need More Roles Than Source And Export Output

Sources:

- `packages/editor-core/src/types/project.ts`
- `packages/editor-core/src/media/types.ts`
- `packages/editor-core/src/storage/types.ts`
- OpenTimelineIO media reference model: https://opentimelineio.readthedocs.io/en/v0.16.0/tutorials/otio-timeline-structure.html

`MediaItem` can reference thumbnails, waveform data, filmstrip thumbnails, original URLs, placeholders, and source-file hints. OpenTimelineIO separates clips from media references and source ranges, which supports keeping media identity/linkage outside the timeline itself.

Implication: `edit_project_asset.role` should include source media, proxies, waveform artifacts, filmstrip thumbnails, subtitle sidecars, thumbnails, and export outputs.

### F1-005: Cache And Device Benchmark Data Should Not Be Server Project Schema

Sources:

- `packages/editor-core/src/storage/types.ts`
- `packages/editor-core/src/device/device-capabilities.ts`
- `packages/editor-core/src/device/export-estimator.ts`

Frame cache entries, waveform cache entries, file handles, directory handles, device profiles, and local benchmark results are runtime/client-local performance data.

Implication: do not add project schema tables for frame caches, shader modules, local file handles, or device benchmarks. Export jobs may store a small renderer/capability snapshot if it helps debug a render.

### F1-006: PostgreSQL JSONB Is Appropriate For The Project Document, But Not For Every Query

Source: PostgreSQL JSON type design guidance: https://www.postgresql.org/docs/current/datatype-json.html

PostgreSQL recommends predictable JSON document structure and notes that JSON updates lock the whole row. It also documents that `jsonb` supports indexing, with targeted expression indexes often smaller/faster than broad whole-document indexes.

Implication: keep project documents in JSONB, but store hot query/lifecycle fields relationally and avoid broad GIN indexes until a query actually needs them.
