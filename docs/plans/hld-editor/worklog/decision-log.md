# Editor Rearchitecture Decision Log

> **Parent LLD Index:** [../README.md](../README.md)
> **Status:** Working log

## Decision Status Legend

- `Proposed`: under discussion, not authoritative.
- `Accepted`: promoted into an LLD/HLD.
- `Rejected`: considered and not chosen.
- `Superseded`: replaced by a later decision.

## D-001: Clean Cutover, No Runtime Backwards Compatibility

> **Status:** Accepted
> **Date:** 2026-04-26
> **Promoted To:** [../README.md](../README.md), [../../hld-editor.md](../../hld-editor.md)

Decision: the migration will use a clean cutover. The old `edit_project.tracks` shape is migration input only and should not remain a supported runtime read/write path.

Rationale: keeping both old and new editor contracts alive would preserve the schema drift the rearchitecture is meant to eliminate.

Consequences:

- Conversion validation must happen before cutover.
- Rollback is backup/app-pair based, not an application fallback.
- Runtime code after cutover should load and save canonical project documents only.

## D-002: Persist A JSON-Safe Core-Derived Document, Not Raw Runtime `Project`

> **Status:** Accepted
> **Date:** 2026-04-26
> **Promoted To:** [../00-inventory-contract-freeze.md](../00-inventory-contract-freeze.md)
> **Related Finding:** [phase-0-findings.md#f-004-raw-editor-core-project-contains-browserruntime-fields](./phase-0-findings.md#f-004-raw-editor-core-project-contains-browserruntime-fields)

Decision: persist a JSON-safe document derived from `editor-core Project`, likely shaped as `{ version, project }`, rather than storing raw runtime `Project` objects.

Rationale: raw `Project.mediaLibrary.items[]` can include `Blob`, `FileSystemFileHandle`, and `Float32Array`, which are runtime/browser objects and not stable durable JSONB.

Consequences:

- Phase 0 must define the exact persisted document type.
- Backend validation must reject runtime-only fields.
- Phase 2 conversion should build serialized project documents, not runtime project instances.

## D-003: Decide Schema Ownership Before Phase 1

> **Status:** Accepted
> **Date:** 2026-04-26
> **Promoted To:** [../00-inventory-contract-freeze.md](../00-inventory-contract-freeze.md)

Decision: editor-specific runtime schemas belong in `packages/editor-core`. Broader product/API contracts that are not editor-domain concepts remain in `packages/contracts`.

Rationale: editor schemas encode editor semantics, persistence shape, timeline/media validity, and serializer versioning. Keeping them in `editor-core` preserves separation of concerns: `editor-core` owns editor domain contracts, while `packages/contracts` owns app-level API contracts for payments, subscriptions, customers, video jobs, and other non-editor domains.

Consequences:

- Backend and frontend import editor document schemas from `packages/editor-core`.
- `packages/contracts` should not grow editor-internal timeline/media schemas.
- Old backend `editor.schemas.ts` becomes migration-only and is removed during cutover.
- Phase 1 can safely add `project_document` with a known validator.
