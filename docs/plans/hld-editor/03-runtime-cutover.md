# Phase 3 LLD: Runtime Cutover

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Switch backend and frontend runtime paths to the canonical project document.

## 1. Purpose

This phase removes the old `tracks` runtime contract and makes the application load, save, validate, and hydrate only the canonical editor project document.

## 2. Scope

In scope:

- Backend route payload changes.
- Backend validation changes.
- Backend serializer boundary and envelope field derivation.
- Frontend editor bridge (new) — hydration, autosave, conflict handling.
- Autosave with optimistic `save_revision`.
- New project creation writing an initial `project_document`.
- SyncService writing canonical document instead of `tracks`.
- AI assembly and fork/restore paths updated to canonical document.
- Removal of old `tracks`-based autosave schema and `validate-stored-tracks`.

Out of scope:

- Final UI behavior cleanup across every editor component (Phase 5).
- Export worker revision rendering (Phase 4).
- Dropping the `tracks` column (Phase 6).

## 3. Canonical Document Shape Decision

The persisted document stored in `edit_project.project_document` (and `edit_project_revision.project_document`) is the `ProjectFile` wrapper from `packages/editor-core/src/storage/project-serializer.ts`:

```ts
// packages/editor-core/src/storage/project-serializer.ts
interface ProjectFile {
  version: string;   // SCHEMA_VERSION, currently "1.0.0"
  project: Project;  // packages/editor-core/src/types/project.ts
}
```

**Why the wrapper, not raw `Project`:** The `version` field enables forward-compatible schema migration in `editor-core` without touching the DB column. Storing the wrapper means the backend can detect and reject version mismatches before hydrating.

**Serialization rule:** Before writing to the DB, strip all browser-only fields using `ProjectSerializer.stripMediaBlobs()`. The stored document must never contain `Blob`, `FileSystemFileHandle`, or `Float32Array`.

**Backend validation:** Use `ProjectSerializer.validateProjectJson()` from `editor-core` as the primary structural check. This validates required top-level fields and checks that clip `mediaId` references exist in `mediaLibrary`. Additional backend Zod can wrap the outer envelope (`{ version: z.string(), project: z.object({...}) }`) at the route layer.

## 4. Envelope Field Derivation

The backend derives these `edit_project` columns from the document on every save:

| Column | Source | Formula |
|---|---|---|
| `fps` | `project.settings.frameRate` | Direct. |
| `resolution` | `project.settings.width`, `project.settings.height` | `"${width}x${height}"` |
| `durationMs` | `project.timeline.duration` | `Math.round(project.timeline.duration * 1000)` — core stores seconds, envelope stores ms. |
| `document_hash` | Serialized document string | `crypto.createHash("sha256").update(json).digest("hex")` |
| `editor_core_version` | `SCHEMA_VERSION` from `editor-core` | Passed in request or resolved from package at write time. |
| `project_document_version` | `projectFile.version` | Extracted from the document itself. |

## 5. Backend API Contract

### 5.1 GET `/api/editor/:id`

Returns the project envelope plus the canonical document:

```ts
interface EditorProjectResponse {
  project: {
    id: string;
    userId: string;
    title: string;
    autoTitle: boolean;
    generatedContentId: number | null;
    status: string;
    publishedAt: string | null;
    thumbnailUrl: string | null;
    durationMs: number;
    fps: number;
    resolution: string;
    saveRevision: number;
    projectDocumentVersion: string;
    editorCoreVersion: string;
    projectDocument: ProjectFile;   // { version, project } — no blobs
    createdAt: string;
    updatedAt: string;
    parentProjectId: string | null;
  };
}
```

The response must not include `tracks`.

### 5.2 PATCH `/api/editor/:id`

Accepts the document and optimistic revision:

```ts
interface PatchEditorProjectRequest {
  expectedSaveRevision: number;
  projectDocument: ProjectFile;    // { version, project } — blobs already stripped by client
  title?: string;                  // optional UI rename
}
```

Backend behavior:

1. Validate `projectDocument` with `ProjectSerializer.validateProjectJson()`.
2. Derive `fps`, `resolution`, `durationMs`, `document_hash`, `project_document_version`, `editor_core_version` from document.
3. Run: `UPDATE edit_project SET project_document=$doc, ..., save_revision=save_revision+1 WHERE id=$id AND user_id=$uid AND save_revision=$expected`.
4. If 0 rows updated → `409 SAVE_REVISION_CONFLICT`.
5. Return `{ id, saveRevision, updatedAt }`.

Conflict response:

```ts
interface SaveConflictResponse {
  code: "SAVE_REVISION_CONFLICT";
  currentSaveRevision: number;
}
```

### 5.3 POST `/api/editor` (create)

On creation, write an initial empty `projectDocument`:

```ts
const initial: ProjectFile = {
  version: SCHEMA_VERSION,
  project: {
    id: newProjectId,
    name: title ?? "Untitled Edit",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    settings: { width: 1080, height: 1920, frameRate: 30, sampleRate: 44100, channels: 2 },
    mediaLibrary: { items: [] },
    timeline: { tracks: [], subtitles: [], duration: 0, markers: [] },
  },
};
```

For generated-content projects, the SyncService derives the initial timeline and the service merges it into this document before inserting. `save_revision` starts at `1`.

## 6. Backend Implementation Areas

All files that must change:

| File | Change |
|---|---|
| `backend/src/domain/editor/editor.schemas.ts` | Replace `patchProjectSchema` (`tracks`, `durationMs`, `fps`, `resolution`) with `patchProjectDocumentSchema` (`expectedSaveRevision`, `projectDocument`, optional `title`). Keep `createProjectSchema` and `exportSchema` unchanged. Delete track/clip/transition Zod schemas once no other file imports them. |
| `backend/src/domain/editor/editor.service.ts` | `createEditorProject`: write initial `project_document` instead of `tracks`. `getProjectWithParsedTracks` → `getProjectWithDocument`: return document directly without track parsing. `patchAutosaveProject`: accept and validate document, derive envelope fields, pass to repository with `expectedSaveRevision`. `createNewDraftFromPublished`: copy `project_document` not `tracks`. |
| `backend/src/domain/editor/editor.repository.ts` | Add `updateProjectDocumentForUser(projectId, userId, { projectDocument, projectDocumentVersion, editorCoreVersion, documentHash, fps, resolution, durationMs, expectedSaveRevision, title? }): Promise<{ id, saveRevision, updatedAt } \| "CONFLICT">`. Add `insertProjectWithDocument(values)`. Remove or deprecate `tracks`-specific interface methods once no callers remain. |
| `backend/src/routes/editor/editor-projects.router.ts` | GET: return canonical document response (§5.1). PATCH: accept `patchProjectDocumentSchema` (§5.2). POST: use `createProjectSchema`, call new `createEditorProject` path. |
| `backend/src/domain/editor/sync/sync.service.ts` | `updateProjectForSync`: read current `project_document`, merge derived tracks into `project.timeline.tracks`, recompute `project.timeline.duration`, re-serialize, write via new `updateProjectDocumentForSync` repository method. Must NOT increment `save_revision` — existing invariant preserved. |
| `backend/src/domain/editor/run-export-job.ts` | Read `project_document.project` instead of parsing `tracks`. Existing `Track`-based rendering logic adapts to `editor-core` `Track` type. |
| `backend/src/routes/editor/editor-ai-assembly.router.ts` | AI assembly builds an assembled timeline. After assembly, write the result into `project.timeline.tracks` of the current `project_document` and save via `patchAutosaveProject` (or a new dedicated method). Must not touch `tracks` column. |
| `backend/src/routes/editor/editor-fork-versions.router.ts` | `forkRootToSnapshotAndOptionalAiReset`: fork copies `project_document` not `tracks`. `restoreRootFromSnapshot`: same. |
| `backend/src/domain/editor/validate-stored-tracks.ts` | Delete. Remove all imports. |

## 7. Frontend Bridge

The bridge is a new module at `frontend/src/domains/creation/editor/bridge/`.

Files:

- `editor-bridge.ts` — bridge class
- `editor-api.ts` — typed HTTP client for editor routes

### 7.1 Bridge Responsibilities

- Load project from API and hydrate `editor-core`.
- Own debounced autosave (serialize → PATCH → update `saveRevision`).
- Track `saveRevision` locally.
- On 409 conflict, mark project dirty and surface conflict state to UI.
- Strip media blobs before sending (`ProjectSerializer.stripMediaBlobs`).

### 7.2 Bridge Public Interface

```ts
interface EditorBridge {
  loadProject(projectId: string): Promise<void>;
  saveNow(): Promise<void>;               // flush debounce immediately
  onProjectChanged(project: Project): void; // called by editor-core after every mutation
  readonly saveRevision: number;
  readonly saveStatus: "idle" | "saving" | "conflict" | "error";
}
```

React components read `saveStatus` from bridge state and dispatch mutations through `editor-core` actions only — they do not build or mutate persistence payloads directly.

### 7.3 Frontend State Changes

`EditorDocumentState` (`frontend/src/domains/creation/editor/model/editor-document.ts`):

- Remove `tracks: Track[]`.
- Add `projectDocument: ProjectFile | null`.
- Add `saveRevision: number`.
- Keep `durationMs`, `fps`, `resolution` as derived UI display fields derived from `projectDocument.project.settings` and `projectDocument.project.timeline`.

`EditorAction` (`editor.ts`):

- Remove `MERGE_TRACKS_FROM_SERVER`.
- Add `LOAD_PROJECT_DOCUMENT: { projectDocument: ProjectFile; saveRevision: number }`.
- Add `SAVE_CONFLICT_DETECTED: { currentSaveRevision: number }`.

`EditorRoutePage` (`editor-route-page.tsx`):

- Remove inline `previewProject` stub with `tracks: []`.
- Replace with a bridge-initialized empty `projectDocument`.

## 8. Autosave Flow

1. User dispatches an editor command through `editor-core` action.
2. `editor-core` emits updated `Project` state.
3. Bridge receives update via `onProjectChanged`.
4. Bridge debounces (300–500 ms).
5. Bridge calls `ProjectSerializer.stripMediaBlobs(project)`, wraps as `ProjectFile`.
6. Bridge sends `PATCH /api/editor/:id` with `{ expectedSaveRevision, projectDocument }`.
7. On success: update `saveRevision`, set `saveStatus = "idle"`.
8. On 409: set `saveStatus = "conflict"`, surface reload prompt to UI.
9. On network error: retry with backoff up to 3 times, then set `saveStatus = "error"`.

## 9. SyncService Document Merge

When `syncLinkedProjects` needs to write an AI-derived timeline into a project that now stores `project_document`:

1. Load current `project_document` from the row.
2. Replace `project.timeline.tracks` with derived tracks (applying existing merge rules from `mergeTrackSets`).
3. Recompute `project.timeline.duration` from the new tracks.
4. Re-serialize, compute new `document_hash`.
5. Write via `updateProjectDocumentForSync(projectId, userId, { projectDocument, documentHash, durationMs })`.
6. Do NOT increment `save_revision`.

The `MERGE_TRACKS_FROM_SERVER` frontend action is replaced by a re-fetch of `project_document` on `updatedAt` change (existing polling or WebSocket/SSE mechanism).

## 10. Validation

- Backend rejects `PATCH` with old `tracks`/`durationMs`/`fps`/`resolution` body shape (schema parse fails).
- Backend rejects invalid `projectDocument` (missing `version`, `project.id`, `project.timeline`).
- Backend derives and writes correct envelope fields from a valid document.
- `GET /api/editor/:id` returns `projectDocument` with no `tracks` top-level field.
- Frontend bridge loads, hydrates `editor-core`, and autosaves without errors.
- Save conflict test: two concurrent PATCH requests with the same `expectedSaveRevision` → second returns 409.
- New project created with empty `projectDocument`, `save_revision = 1`.
- SyncService update increments `updatedAt` but does not change `save_revision`.
- Fork/restore copies `project_document`, not `tracks`.
- AI assembly writes updated `project_document`.
- `validate-stored-tracks.ts` has no remaining imports.

## 11. Exit Criteria

- No runtime route reads `edit_project.tracks`.
- No runtime route writes `edit_project.tracks`.
- Frontend editor opens from `projectDocument`.
- Autosave writes canonical documents only.
- Conflict detection (save_revision mismatch) is tested.
- SyncService merge preserves existing sync invariants (no save_revision bump, user edits win).
- All six extra affected files (sync, export, assembly, fork, link-content, validate-stored-tracks) are updated or deleted.

## 12. Rollback

Before release, rollback is redeploying the previous app version. The `tracks` column is still present (not dropped until Phase 6), so the old app can read it. After release, fix forward against the canonical document path; do not reintroduce mixed runtime compatibility.
