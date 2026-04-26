# Editor Rearchitecture Research Notes

> **Parent LLD Index:** [../README.md](../README.md)
> **Status:** Working notes

## Research Topics To Track

### R-001: JSONB Document Plus Relational Envelope

Sources:

- PostgreSQL JSON types: https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL expression indexes: https://www.postgresql.org/docs/current/indexes-expressional.html
- PostgreSQL generated columns: https://www.postgresql.org/docs/current/ddl-generated-columns.html

Working note: JSONB is a practical fit for the versioned editor document, but relational fields should remain relational when they are used for auth, joins, listing, status filters, or export provenance.

### R-002: Runtime Validation For TypeScript Contracts

Sources to verify during Phase 0:

- Zod documentation: https://zod.dev/
- JSON Schema documentation: https://json-schema.org/

Working note: TypeScript types alone are not enough at the backend boundary. The project document needs runtime validation for API requests, database reads, conversion outputs, and export revisions.

### R-003: Local-First Responsiveness Without Full Offline Sync

Source:

- Local-first software paper: https://martin.kleppmann.com/papers/local-first.pdf

Working note: The editor should feel local-first for interaction latency, but Phase 0 does not need to solve CRDTs, offline sync, or collaboration. The contract freeze should support local editing plus server-backed durability.
