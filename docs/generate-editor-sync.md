# Generate ↔ Editor Sync: Complete Flow Documentation

## Overview

The sync between `/generate` (chat) and `/editor` is **unidirectional and link-based**, not a live two-way data sync. The core mechanism is a single foreign key: `EditProject.generatedContentId → generated_content.id`. Once that link exists, navigation between the two pages is trivially resolved.

There is no background polling, no websocket push, and no automatic content mirroring. The only sync that happens is:
1. **Generate → Editor**: When you create an editor project from a draft, it bakes the content's assets into the timeline once.
2. **Editor → Generate**: When you open an editor project in chat, it finds or creates a chat session tied to the project's linked content.

---

## 1. The Core Data Model

### `generated_content` (PostgreSQL)
Represents one version of AI-generated content. Has a `parentId` forming a version chain.

```
generated_content:
  id                 INT
  userId             TEXT
  parentId           INT | null       ← version chain parent
  status             "draft" | "processing" | "ready" | ...
  generatedHook      TEXT | null
  generatedScript    TEXT | null
  voiceoverScript    TEXT | null
  postCaption        TEXT | null
  sceneDescription   TEXT | null
  generatedMetadata  JSONB | null
  outputType         "full" | ...
  version            INT
```

### `edit_projects` (PostgreSQL)
One editor project per "video being made." May or may not be linked to generated content.

```
edit_projects:
  id                  UUID
  userId              TEXT
  generatedContentId  INT | null    ← THE LINK
  title               TEXT | null
  tracks              JSONB         ← serialized timeline
  durationMs          INT
  fps                 INT
  resolution          TEXT
  status              "draft" | "published"
  generatedHook       TEXT | null   ← denormalized copy
  postCaption         TEXT | null   ← denormalized copy
```

### `chat_messages` (PostgreSQL)
Each assistant message that triggered a content generation stores the resulting content ID.

```
chat_messages:
  id                  UUID
  sessionId           TEXT
  role                "user" | "assistant"
  generatedContentId  INT | null    ← which content this message produced
```

---

## 2. The "Drafts" Concept in /generate

When you're on `/generate` with a session open, the right-side **ContentWorkspace** panel shows "drafts." These are not the same as editor projects. They are `generated_content` records that were produced by messages in that chat session.

### How Drafts Are Fetched

**Hook**: `useSessionDrafts(sessionId)` — `frontend/src/features/chat/hooks/use-session-drafts.ts`

**Endpoint**: `GET /api/chat/sessions/:id/content`

**Backend logic** — `ContentRepository.findChainTipDraftsForSession()` in `backend/src/domain/content/content.repository.ts`:

1. Query all `chat_messages` for the session where `role = "assistant"` and `generatedContentId IS NOT NULL`.
2. Deduplicate and collect those `generatedContentId` values.
3. Fetch all those `generated_content` records.
4. Find which of those IDs appear as `parentId` in any other content record. Those have been iterated on — they're not the latest version.
5. Filter to only the **chain tips** (records that have no children). These are the most up-to-date versions of each generated piece.
6. Sort ascending by `createdAt`.

This means: if you generate content, then ask the AI to "change the hook," the original becomes a parent, the new version is the tip — only the new version shows in the drafts panel.

**Response shape** — `SessionDraft`:
```typescript
{
  id: number;
  version: number;
  outputType: string;
  status: string;
  generatedHook: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  postCaption: string | null;
  sceneDescription: string | null;
  generatedMetadata: {
    hashtags?: string[];
    cta?: string;
    contentType?: string;
    changeDescription?: string;
  } | null;
  createdAt: string;
}
```

---

## 3. What Happens When the AI Generates Content (Streaming)

**Hook**: `useChatStream` — `frontend/src/features/chat/hooks/use-chat-stream.ts`

**Endpoint**: `POST /api/chat/sessions/:id/messages` → returns SSE stream

### SSE Stream Processing — `frontend/src/features/chat/streaming/sse-client.ts`

The stream emits typed chunks processed by `processStreamSseLine()`:

| Chunk type | Action |
|---|---|
| `text-delta` | Appends to `accumulated` string, calls `setStreamingContent()` |
| `tool-input-start` (for `save_content`, `iterate_content`, `edit_content_field`) | Calls `setIsSavingContent(true)` — shows a saving indicator in the UI |
| `tool-output-available` | If `output.contentId` present, calls `setStreamingContentId(output.contentId)` and `setIsSavingContent(false)` |

So the `contentId` of newly generated content flows out of the SSE stream via `tool-output-available`.

### After Stream Completes

Back in `useChatStream` (lines 120-124):
```typescript
patchSessionCacheAfterStream(queryClient, sessionId, optimisticMsg, ingest.accumulated);
void invalidateChatSessionQuery(queryClient, sessionId);
```

This patches the chat message list cache optimistically, then invalidates it for a real refetch.

### ContentWorkspace Reacts

`ContentWorkspace.tsx` watches `streamingContentId` in two effects:

```typescript
// Effect 1: Re-fetch the drafts panel
useEffect(() => {
  if (streamingContentId) {
    void invalidateSessionDrafts(queryClient, sessionId);
  }
}, [streamingContentId]);

// Effect 2: Auto-select the new draft
useEffect(() => {
  if (streamingContentId) {
    onActiveContentChange(streamingContentId);
  }
}, [streamingContentId]);
```

`invalidateSessionDrafts()` invalidates the `queryKeys.api.sessionDrafts(sessionId)` cache key, which triggers a refetch of `GET /api/chat/sessions/:id/content`. The new draft appears in the panel and is auto-selected.

---

## 4. Opening a Draft in the Editor (Generate → Editor)

This is triggered from `DraftDetail` or a similar UI button. The navigation goes to `/editor?contentId=<generatedContentId>`.

### EditorRoutePage Lookup — `frontend/src/features/editor/components/EditorRoutePage.tsx` (lines 256–287)

On mount, the component checks URL search params. If `contentId` is present but `projectId` is not:

```typescript
const existing = projects.find((p) => p.generatedContentId === contentId);
if (existing) {
  fetchAndOpen(existing.id);    // Project already exists → open it
} else {
  createFromContent(contentId); // No project → create one
}
```

**"Already has a project"**: The projects list (`GET /api/editor`) is already cached. It scans for any project whose `generatedContentId` matches the content being opened. If found, it immediately navigates to that project — no extra API call.

**"No project yet"**: Fires the `createFromContent` mutation.

### Creating a Project from Content

**Mutation**: `POST /api/editor` with `{ generatedContentId: number }`

**Backend service** — `EditorService.createEditorProject()` in `backend/src/domain/editor/editor.service.ts` (lines 82–171):

1. Fetch content metadata: `content.findIdAndHookForUser(generatedContentId, userId)` — validates ownership, gets hook text.
2. Check if a project already exists anywhere in the content's version chain using `resolveContentAncestorChainIds()`. This prevents creating duplicate projects when the user opens a child version of something they already have in the editor.
3. Call `buildInitialTimeline(content, generatedContentId, userId, captionsService)` — converts the content's assets (voiceover audio, music, video shots) into editor `Track[]` and computes `durationMs`.
4. Insert the project:
   ```typescript
   editor.insertProject({
     generatedContentId,
     title: content.generatedHook ?? "Untitled",
     tracks: timeline.tracks,
     durationMs: timeline.durationMs,
     generatedHook: content.generatedHook,
     postCaption: content.postCaption,
   })
   ```

**On success** (lines 242–244 of EditorRoutePage):
```typescript
await invalidateEditorProjectsQueries(queryClient);
openProject(data.id); // Navigate to /editor?projectId=data.id&contentId=...
```

### 409 Race Condition Handling

If the user double-clicks or two tabs fire simultaneously:

```typescript
onError: (err) => {
  if (err.status === 409) {
    // Another request already created the project
    // Re-scan the now-invalidated projects list and open the existing one
    const existing = projects.find(p => p.generatedContentId === contentId);
    if (existing) fetchAndOpen(existing.id);
  }
}
```

---

## 5. Opening an Editor Project in Chat (Editor → Generate)

From an editor project card, clicking "Open in AI Chat" fires a mutation in `EditorRoutePage` (lines 310–337).

### Step 1: Ensure the Project Has a Linked Content

```typescript
let targetContentId = proj.generatedContentId;

if (!targetContentId) {
  // Project was created blank, not from content
  const res = await authenticatedFetchJson(
    `/api/editor/${proj.id}/link-content`,
    { method: "POST" }
  );
  targetContentId = res.generatedContentId;
}
```

**Endpoint**: `POST /api/editor/:id/link-content` — `backend/src/routes/editor/editor-link-content.router.ts`

If the project already has a `generatedContentId`, returns it immediately.

If not, `EditorRepository.createDraftContentAndLinkBlankProject()` runs a **transaction**:
1. `INSERT INTO generated_content ({ userId, status: "draft", version: 1, outputType: "full" })` — blank draft with no hook/script.
2. `UPDATE edit_projects SET generatedContentId = newContent.id WHERE id = projectId AND generatedContentId IS NULL` — atomic link, conditional on it still being null (prevents races).
3. `INSERT INTO queue_items ({ userId, generatedContentId: newContent.id, status: "draft" })`.

Returns the new `generatedContentId`.

Race condition: if the `UPDATE` affects 0 rows (another request won), the error is caught and the existing linked ID is fetched and returned instead.

### Step 2: Resolve (or Create) a Chat Session for the Content

**Endpoint**: `POST /api/chat/sessions/resolve-for-content` with `{ generatedContentId }`

**Backend** — `ChatService.findOrCreateSessionForContent()` in `backend/src/domain/chat/chat.service.ts` (lines 34–74):

1. Query `chat_messages` joined to `chat_sessions` to find any session that already has a message with this `generatedContentId`. Return it if found.
2. If not found:
   - Fetch content metadata (hook for session title).
   - Find user's most recent project, or create a new one.
   - Create a new `chat_session` with `title = content.generatedHook ?? "Chat Session"`.
3. Return `{ sessionId, projectId, isNew }`.

### Step 3: Navigate to /generate

```typescript
navigate({ to: "/generate", search: { sessionId, projectId } });
```

The `/generate` page loads with the session, and its messages and drafts are fetched normally.

---

## 6. Full Sequence Diagrams

### Scenario A: New Draft → Open in Editor (first time)

```
User: click "Open in Editor" on DraftDetail (contentId=42)
  ↓
Navigate to /editor?contentId=42
  ↓
EditorRoutePage mounts
  GET /api/editor  (already cached)
  scan: projects.find(p => p.generatedContentId === 42)
  → NOT FOUND
  ↓
Mutation: POST /api/editor { generatedContentId: 42 }
  ↓
Backend EditorService.createEditorProject()
  → content.findIdAndHookForUser(42, userId)  ✓
  → resolveContentAncestorChainIds(42)  → no existing project
  → buildInitialTimeline(42)  → Track[]
  → editor.insertProject({ generatedContentId: 42, tracks, title: hook })
  → returns EditProject { id: "proj-abc", ... }
  ↓
Frontend:
  invalidateEditorProjectsQueries()
  Navigate to /editor?projectId=proj-abc&contentId=42
  ↓
EditorRoutePage:
  GET /api/editor/proj-abc  → renders timeline
```

### Scenario B: Re-opening an Existing Project from Content

```
User: click "Open in Editor" on DraftDetail (contentId=42, again)
  ↓
Navigate to /editor?contentId=42
  ↓
EditorRoutePage mounts
  scan: projects.find(p => p.generatedContentId === 42)
  → FOUND: { id: "proj-abc", ... }
  ↓
fetchAndOpen("proj-abc")
  Navigate to /editor?projectId=proj-abc&contentId=42
  No API call to create anything
```

### Scenario C: Editor Project → Open in Chat

```
User: click "Open in AI Chat" on editor project card { id: "proj-abc", generatedContentId: null }
  ↓
proj.generatedContentId is null
  POST /api/editor/proj-abc/link-content
  ↓
Backend: transaction
  INSERT generated_content { status: "draft" }  → id=99
  UPDATE edit_projects SET generatedContentId=99 WHERE id=proj-abc AND generatedContentId IS NULL
  INSERT queue_items { generatedContentId: 99, status: "draft" }
  → returns { generatedContentId: 99 }
  ↓
POST /api/chat/sessions/resolve-for-content { generatedContentId: 99 }
  ↓
Backend ChatService:
  findSessionByContentId(userId, 99)  → NOT FOUND
  findContentById(99)  → { generatedHook: null, ... }
  find/create project
  createSession({ title: "Chat Session", projectId })
  → returns { sessionId: "sess-xyz", projectId, isNew: true }
  ↓
Navigate to /generate?sessionId=sess-xyz&projectId=proj-456
```

### Scenario D: New Content Generated in Chat → Workspace Updates

```
User: send message in chat
  ↓
POST /api/chat/sessions/sess-xyz/messages { content: "..." }
  ↓
SSE stream begins
  text-delta chunks → setStreamingContent() → chat bubble updates live
  tool-input-start (save_content) → setIsSavingContent(true) → UI shows "saving"
  tool-output-available { contentId: 55 } → setStreamingContentId(55)
                                           → setIsSavingContent(false)
  stream ends
  ↓
useChatStream:
  patchSessionCacheAfterStream() → optimistic message in cache
  invalidateChatSessionQuery()   → refetch session messages
  ↓
ContentWorkspace effect [streamingContentId=55]:
  invalidateSessionDrafts(queryClient, sessionId)
  → GET /api/chat/sessions/sess-xyz/content
  → returns drafts including new content 55 as chain tip
  ↓
ContentWorkspace effect [streamingContentId=55]:
  onActiveContentChange(55)
  → DraftDetail renders content 55
```

---

## 7. Cache Keys and Invalidation

All TanStack Query cache keys — `frontend/src/shared/lib/query-keys.ts`:

| Key | Shape | Invalidated by |
|---|---|---|
| `editorProjects()` | `["api", "editor", "projects"]` | After creating/updating/deleting editor projects |
| `editorProject(id)` | `["api", "editor", "project", id]` | After autosave |
| `sessionDrafts(sessionId)` | `["api", "session-drafts", sessionId]` | After `streamingContentId` is set |
| `chatSession(sessionId)` | `["chat-sessions", sessionId]` | After message stream completes |

---

## 8. What Does NOT Sync

- **Content edits after project creation**: If you go back to chat and iterate on content (e.g., change the hook), the editor project is **not updated**. The `generatedHook` / `postCaption` on `edit_projects` is a denormalized snapshot taken at creation time.
- **Timeline changes don't reflect in chat**: Editor autosave only updates `edit_projects.tracks` and `edit_projects.updatedAt`. The `generated_content` record is never modified by editor actions.
- **Version chains**: If you've iterated content 3 times in chat (parent → child → grandchild), opening the grandchild in the editor creates a new project linked to the grandchild. The editor has no knowledge of the chain; it only knows its own `generatedContentId`.

---

## 9. All Relevant Files

### Frontend

| File | Role |
|---|---|
| `features/chat/hooks/use-chat-stream.ts` | SSE streaming, captures `streamingContentId` |
| `features/chat/streaming/sse-client.ts` | Parses SSE chunks, emits `tool-output-available` |
| `features/chat/components/ContentWorkspace.tsx` | Workspace panel; invalidates drafts on new content |
| `features/chat/hooks/use-session-drafts.ts` | Query hook for `GET /api/chat/sessions/:id/content` |
| `features/chat/services/chat.service.ts` | API client: `getSessionDrafts`, `streamMessage` |
| `features/chat/components/DraftDetail.tsx` | Renders a single draft, "Open in Editor" button |
| `features/editor/components/EditorRoutePage.tsx` | Resolves `contentId` → project, handles create + navigate |
| `features/editor/services/editor-api.ts` | API client: `createEditorProject`, `patchEditorProject` |
| `shared/lib/query-keys.ts` | Single source of truth for all cache keys |
| `shared/lib/query-invalidation.ts` | `invalidateSessionDrafts`, `invalidateEditorProjectsQueries` |

### Backend

| File | Role |
|---|---|
| `routes/editor/editor-projects.router.ts` | `POST /api/editor`, `GET /api/editor/:id` |
| `routes/editor/editor-link-content.router.ts` | `POST /api/editor/:id/link-content` |
| `routes/chat/sessions.router.ts` | `GET /api/chat/sessions/:id/content`, `POST /api/chat/sessions/resolve-for-content` |
| `domain/editor/editor.service.ts` | `createEditorProject()` — builds timeline, inserts project |
| `domain/editor/editor.repository.ts` | `createDraftContentAndLinkBlankProject()` — transactional link |
| `domain/editor/build-initial-timeline.ts` | Converts content assets → `Track[]` |
| `domain/chat/chat.service.ts` | `findOrCreateSessionForContent()` |
| `domain/content/content.repository.ts` | `findChainTipDraftsForSession()` — chain tip resolution logic |
