# Phase 4 LLD: Export From Revisions

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Ready to implement
> **Goal:** Make every export job render an immutable project revision.

## 1. Purpose

Exports must be deterministic. A job should render the exact project document saved at
request time, not the mutable latest project row. This phase wires up the
`edit_project_revision` table — which already exists in the schema — to the export
pipeline, so that:

- The rendered output is always reproducible from `projectRevisionId + exportSettings`.
- Editing the project after export starts does not change the render input.
- Failed jobs remain inspectable with the exact document that caused the failure.

## 2. Current State

```
POST /api/editor/:id/export
  → insertQueuedExportJob(projectId, userId)   ← no revision created
  → runExportJob(jobId, project, ...)          ← reads mutable project.projectDocument
```

`export_job.project_revision_id` exists in the schema but is **never populated**.
`export_job.export_settings` exists but is **never written**.
`export_job.progress_phase`, `started_at`, `completed_at` exist but are **never written**.

## 3. Target State

```
POST /api/editor/:id/export
  → load project row (already done)
  → insertExportRevision(projectId, userId, projectDocument, ...)  ← NEW
  → insertQueuedExportJob(projectId, userId, revisionId, settings) ← UPDATED
  → runExportJob(jobId, revisionId, settings, ...)
      → loadRevisionDocument(revisionId)                           ← NEW dep
      → render from revision document
```

## 4. Schema — No Migrations Needed

All required columns already exist. Nothing to add.

Columns used by this phase (all currently unpopulated):

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `export_job` | `project_revision_id` | `text` FK nullable | Set at job creation |
| `export_job` | `export_settings` | `jsonb` | `{ resolution, fps }` |
| `export_job` | `progress_phase` | `text` | e.g. `"downloading"`, `"encoding"` |
| `export_job` | `started_at` | `timestamp` | Set when worker starts render |
| `export_job` | `completed_at` | `timestamp` | Set on done or failed |
| `edit_project_revision` | `kind` | `text` | `"export"` for this phase |

## 5. Design Decisions

### 5a. What document does the revision snapshot?

**Decision:** Snapshot `edit_project.project_document` at the moment `POST /export` is
received. This is the latest server-acknowledged state.

**Rationale:** The frontend autosaves on a 2-second debounce. If the user clicks Export
immediately after an edit, the in-flight autosave may not have landed. Rather than
blocking the export on a forced autosave (which adds latency and complexity), we export
the last version the server knows about. This is the correct behaviour: the user sees
the state they saved, and clicking Export twice gives idempotent results for the same
server document.

### 5b. `revisionNumber` assignment

`edit_project_revision` has a `unique(project_id, revision_number)` constraint.

**Strategy:** Inside the `insertExportRevision` transaction, compute:
```sql
SELECT COALESCE(MAX(revision_number), 0) + 1 FROM edit_project_revision WHERE project_id = $projectId FOR UPDATE
```

**Important caveat — first insert race:** `FOR UPDATE` only locks existing rows. When
the table has no rows for this `project_id` (first ever export), there are no rows to
lock, so two concurrent requests both compute `MAX = NULL → 0`, both attempt to insert
`revision_number = 1`, and one will fail with a unique-constraint violation on
`(project_id, revision_number)`.

**Required handling:** Catch the unique-constraint violation (Postgres error code `23505`)
and retry the SELECT MAX + INSERT once. In practice this race only occurs on the very
first export per project and the retry always succeeds. Implementation:

```typescript
async function insertWithRevisionNumber(tx, values) {
  try {
    const [{ next }] = await tx.execute(
      sql`SELECT COALESCE(MAX(revision_number), 0) + 1 AS next
          FROM edit_project_revision
          WHERE project_id = ${values.projectId}
          FOR UPDATE`
    );
    return await tx.insert(editProjectRevisions).values({ ...values, revisionNumber: next }).returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      // First-insert race: retry once — next MAX read will see the winning row
      const [{ next }] = await tx.execute(
        sql`SELECT COALESCE(MAX(revision_number), 0) + 1 AS next
            FROM edit_project_revision
            WHERE project_id = ${values.projectId}
            FOR UPDATE`
      );
      return await tx.insert(editProjectRevisions).values({ ...values, revisionNumber: next }).returning();
    }
    throw err;
  }
}
```

Where `isUniqueViolation(err)` checks `(err as { code?: string }).code === "23505"`.

### 5c. Export response shape

Return `{ exportJobId, projectRevisionId }` so the client can later reference the
revision if needed.

## 6. Repository Changes

### 6a. New method: `insertExportRevision`

Add to `IEditorRepository` and `EditorRepository`:

```typescript
insertExportRevision(params: {
  projectId: string;
  userId: string;
  projectDocument: PersistedProjectFile;
  documentHash: string;
}): Promise<{ id: string; revisionNumber: number }>
```

Implementation notes:
- Run inside a transaction.
- Compute `revisionNumber` via `SELECT COALESCE(MAX(revision_number), 0) + 1 ... FOR UPDATE`.
- Set `kind = "export"`.
- Set `projectDocumentVersion = PERSISTED_DOCUMENT_VERSION`, `editorCoreVersion = PERSISTED_DOCUMENT_VERSION`.

### 6b. Updated method: `insertQueuedExportJob`

Current signature:
```typescript
insertQueuedExportJob(editProjectId: string, userId: string): Promise<{ id: string }>
```

New signature:
```typescript
insertQueuedExportJob(
  editProjectId: string,
  userId: string,
  projectRevisionId: string,
  exportSettings: { resolution?: string; fps?: number },
): Promise<{ id: string }>
```

Write `project_revision_id`, `export_settings`, `input_document_hash` at insertion time.

### 6c. New method: `findRevisionById`

```typescript
findRevisionById(
  revisionId: string,
  userId: string,
): Promise<{ projectDocument: unknown } | null>
```

Simple SELECT by id + userId. Used by the export worker.

### 6d. Extended method: `updateExportJob`

Extend the `patch` type to include:
```typescript
patch: {
  status?: string;
  progress?: number;
  progressPhase?: string;
  error?: string | null;
  outputAssetId?: string | null;
  startedAt?: Date;
  completedAt?: Date;
}
```

## 7. Router Changes (`editor-export.router.ts`)

### 7a. `POST /api/editor/:id/export`

Replace:
```typescript
const job = await editorRepository.insertQueuedExportJob(id, auth.user.id);
runExportJob(job.id, project, auth.user.id, parsed).catch(...)
return c.json({ exportJobId: job.id }, 202);
```

With:
```typescript
const doc = project.projectDocument as PersistedProjectFile | null;
if (!doc) throw Errors.badRequest("Project has no document yet");

const revision = await editorRepository.insertExportRevision({
  projectId: id,
  userId: auth.user.id,
  projectDocument: doc,
  documentHash: computeDocumentHash(doc),
});

const job = await editorRepository.insertQueuedExportJob(
  id,
  auth.user.id,
  revision.id,
  { resolution: parsed.resolution, fps: parsed.fps },
);

runExportJob(job.id, revision.id, auth.user.id, parsed).catch(...)
return c.json({ exportJobId: job.id, projectRevisionId: revision.id }, 202);
```

### 7b. `GET /api/editor/:id/export/status`

Add `projectRevisionId` to the response:
```typescript
return c.json({
  status: job.status,
  progress: job.progress,
  progressPhase: job.progressPhase ?? undefined,
  projectRevisionId: job.projectRevisionId ?? undefined,
  r2Url,
  error: job.error ?? undefined,
});
```

## 8. Worker Changes

### 8a. `export-worker.ts`

Change call signature from passing `project` object to passing `revisionId`:

```typescript
export async function runExportJob(
  jobId: string,
  revisionId: string,
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  return runExportJobCore(jobId, revisionId, userId, opts, {
    updateExportJob: (id, p) => editorRepository.updateExportJob(id, p),
    loadRevisionDocument: (rid) => editorRepository.findRevisionById(rid, userId),
    findManyAssetsByIdsForUser: (uid, ids) =>
      assetsRepository.findManyByIdsForUser(uid, ids),
    insertAssembledVideoAsset: (row) => assetsRepository.insertAsset(row),
  });
}
```

### 8b. `run-export-job.ts` — `ExportJobDbDeps`

Add dep and update signature:

```typescript
export type ExportJobDbDeps = {
  updateExportJob: (jobId: string, patch: { ... }) => Promise<void>;
  loadRevisionDocument: (revisionId: string) => Promise<{ projectDocument: unknown } | null>;
};

export async function runExportJob(
  jobId: string,
  revisionId: string,           // ← was: project: { id, projectDocument, ... }
  userId: string,
  opts: { resolution?: string; fps?: number },
  deps: ExportJobDbDeps & { ... },
) {
```

### 8c. Document loading in worker

Replace:
```typescript
const doc = project.projectDocument as PersistedProjectFile | null;
const tracks = (doc?.project?.timeline?.tracks ?? []) as unknown as Track[];
const fps = opts.fps ?? project.fps ?? 30;
const resolution = opts.resolution ?? project.resolution ?? "1080x1920";
```

With:
```typescript
await deps.updateExportJob(jobId, { status: "rendering", progress: 5, startedAt: new Date() });

const revisionRow = await deps.loadRevisionDocument(revisionId);
if (!revisionRow) {
  await deps.updateExportJob(jobId, { status: "failed", error: "Revision not found", completedAt: new Date() });
  return;
}

const doc = revisionRow.projectDocument as PersistedProjectFile | null;
const tracks = (doc?.project?.timeline?.tracks ?? []) as unknown as Track[];
const fps = opts.fps ?? doc?.project?.settings?.frameRate ?? 30;
const resolution = opts.resolution
  ?? (doc ? `${doc.project.settings.width}x${doc.project.settings.height}` : "1080x1920");
```

### 8d. Completion / failure writes

On success, also write `completedAt`:
```typescript
await deps.updateExportJob(jobId, {
  status: "done",
  progress: 100,
  outputAssetId: outputAsset.id,
  completedAt: new Date(),
});
```

On failure:
```typescript
await deps.updateExportJob(jobId, {
  status: "failed",
  error: message.slice(0, 500),
  completedAt: new Date(),
}).catch(() => {});
```

### 8e. Progress phases

Annotate each `setJobProgress` call with a `progressPhase` so the frontend can display
meaningful status text:

| Progress | Phase string |
|----------|-------------|
| 5 | `"starting"` |
| 20 | `"downloading"` |
| 40 | `"downloading"` |
| 55 | `"encoding"` |
| 85 | `"uploading"` |
| 100 | `"done"` |

## 9. Frontend Changes

`ExportJobStatus` (in `editor-domain.ts`) should add optional fields:
```typescript
export interface ExportJobStatus {
  status: "idle" | "queued" | "rendering" | "done" | "failed";
  progress: number;
  progressPhase?: string;
  projectRevisionId?: string;
  r2Url?: string;
  error?: string;
}
```

No other frontend changes required for Phase 4.

## 10. Contracts Affected

`editor.schemas.ts` — no changes needed. `exportSchema` already accepts `resolution` and `fps`.

`editor.repository.ts` — `IEditorRepository` interface gains:
- `insertExportRevision`
- `findRevisionById`
- updated `insertQueuedExportJob` signature
- extended `updateExportJob` patch type

## 11. Validation (acceptance criteria)

- `POST /export` response includes `projectRevisionId`.
- `export_job.project_revision_id` is non-null for all new jobs.
- `export_job.export_settings` stores the requested resolution/fps.
- Editing and autosaving a project after export starts does not change `edit_project_revision.project_document` for that job.
- Failed jobs have the exact `project_revision_id` that caused the failure — re-running with same settings should reproduce the failure.
- `GET /export/status` returns `progressPhase` while rendering.
- Worker no longer reads `edit_project.project_document` for render input.

## 12. Rollback

If export validation fails before release: revert `insertExportRevision` call and
`insertQueuedExportJob` signature — worker falls back to reading project row. The
nullable `project_revision_id` column makes this safe without a schema change.

## 13. Out of Scope

- Replacing the render engine (FFmpeg stays as-is).
- Redesigning final asset storage.
- Autosave-before-export force-flush (see §5a — intentionally not implemented).
- Purging old export revisions (future cleanup phase).
- UI for browsing past export revisions.
