# Editor Rearchitecture LLD Index

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Migration style:** Clean cutover. No long-lived backwards compatibility for the old `edit_project.tracks` runtime shape.

This folder breaks the editor rearchitecture into phase-level low-level design documents. Each phase should be reviewed and updated independently before implementation starts for that phase.

Working notes, raw findings, and decision records live in [worklog/](./worklog/). Phase LLDs should contain settled implementation direction; the worklog should contain the reasoning trail.

## Phase Documents

| Phase | Document | Purpose |
|---|---|---|
| 0 | [Inventory And Contract Freeze](./00-inventory-contract-freeze.md) | Freeze the canonical persisted editor document and classify every old field. |
| 1 | [Target Schema Migration](./01-target-schema-migration.md) | Design the target Drizzle/Postgres schema for project documents, revisions, exports, and assets. |
| 2 | [One-Time Data Conversion](./02-one-time-data-conversion.md) | ~~Convert current `tracks` data into canonical `editor-core` project documents.~~ **Skipped** — DB reset before cutover; no legacy data. |
| 3 | [Runtime Cutover](./03-runtime-cutover.md) | Switch backend and frontend runtime paths to the canonical document shape. |
| 4 | [Export From Revisions](./04-export-from-revisions.md) | Make export jobs render immutable project revisions. |
| 5 | [Frontend Runtime Completion](./05-frontend-runtime-completion.md) | Finish moving editor UI behavior through the bridge and Zustand runtime wiring. |
| 6 | [Cleanup](./06-cleanup.md) | Remove old schemas, columns, models, and temporary migration scaffolding. |
| 7 | [Editor-Core Package And Frontend Engine Integration](./07-editor-core-package-and-frontend-integration.md) | Turn `editor-core` into a real package and make the frontend editor run on it directly. |

## Review Order

Review phases in order. Later phases may be refined before earlier phases are implemented, but implementation should not skip the contract freeze or conversion validation phases. The clean migration only works if the canonical document shape is settled before schema and runtime cutover work begins.
