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
- Backend serializer boundary.
- Frontend editor bridge hydration.
- Autosave with optimistic `save_revision`.
- Removal of old editor autosave body shape.

Out of scope:

- Final UI behavior cleanup across every editor component.
- Export worker revision rendering, covered in Phase 4.
- Dropping old columns, covered in Phase 6 if not already done.

## 3. Backend API Contract

### 3.1 Get Project

`GET /api/editor/:id` should return:

```ts
interface EditorProjectResponse {
  project: {
    id: string;
    userId: string;
    title: string;
    generatedContentId: number | null;
    status: string;
    thumbnailUrl: string | null;
    saveRevision: number;
    projectDocumentVersion: string;
    contractVersion: string;
    projectDocument: unknown;
    createdAt: string;
    updatedAt: string;
  };
}
```

The response should not include `tracks` as a top-level runtime field.

### 3.2 Patch Project

`PATCH /api/editor/:id` should accept:

```ts
interface PatchEditorProjectRequest {
  expectedSaveRevision: number;
  projectDocument: unknown;
}
```

The backend validates the document, derives envelope fields, checks `expectedSaveRevision`, increments `save_revision`, updates `document_hash`, and returns the new revision.

Conflict response:

```ts
interface SaveConflictResponse {
  code: "SAVE_REVISION_CONFLICT";
  currentSaveRevision: number;
}
```

## 4. Backend Implementation Areas

| Area | Change |
|---|---|
| `backend/src/domain/editor/editor.schemas.ts` | Replace old track patch schema with canonical project document schema. |
| `backend/src/domain/editor/editor.service.ts` | Save/load canonical document and derive envelope fields. |
| `backend/src/domain/editor/editor.repository.ts` | Read/write `project_document`, version fields, hash, and `save_revision`. |
| `backend/src/routes/editor/editor-projects.router.ts` | Update request/response contract. |
| `packages/contracts` or `packages/editor-core` | Provide runtime validation schema. |

## 5. Frontend Bridge

The frontend bridge should own:

- API load.
- Core hydration.
- Document serialization for save.
- Debounced autosave.
- Save revision tracking.
- Conflict surfacing to UI state.

React components should not build or mutate persistence payloads directly.

## 6. Autosave Flow

1. UI dispatches an editor command.
2. Bridge applies command through `editor-core`.
3. Bridge serializes canonical project document.
4. Bridge sends `expectedSaveRevision`.
5. Backend validates and saves if revision matches.
6. Bridge updates local `saveRevision`.
7. On conflict, bridge marks the project as needing reload/merge decision.

## 7. Validation

- Backend rejects old `tracks` autosave payloads.
- Backend rejects invalid canonical documents.
- Backend updates derived envelope fields from the document.
- Frontend can open a converted project.
- Frontend can autosave and receive incremented `saveRevision`.
- Save conflict test proves stale writes are rejected.

## 8. Exit Criteria

- No runtime route reads `edit_project.tracks`.
- No runtime route writes `edit_project.tracks`.
- Frontend editor opens from `projectDocument`.
- Autosave writes canonical documents only.
- Contract tests pass on backend and frontend.

## 9. Rollback

Before release, rollback is redeploying the previous app and restoring the pre-cutover backup. After release, fix forward against the canonical document path; do not reintroduce mixed runtime compatibility.
