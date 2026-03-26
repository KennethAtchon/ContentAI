# LLD: 1.1 — AI Chat Session Button Fix (Revised)

**Status:** Ready for implementation
**Spec reference:** PM Product Spec §1.1
**Priority:** P0 — active regression
**Supersedes:** Previous LLD-1.1 (queue-only scope)

---

## Problem

The "Open AI Chat" button exists in two places — the Queue Detail panel and the Editor projects list. Both are broken in different ways.

**Queue Detail Panel (`queue.tsx` ~line 1193):**
- Button is hidden behind `{sessionId && (...)}` — it simply doesn't render if no `chat_message` row links to the content (older items, content not created via chat)
- When it does render, navigates with only `?sessionId=X` — `ChatLayout` never sets `selectedProject`, so the project sidebar shows nothing highlighted

**Editor Projects List (`editor.tsx` ~line 277):**
- `openInAIChat()` ensures a `generatedContentId` exists (creates one if blank), but then navigates to `/studio/generate` **with no URL params at all** — the user lands on a blank chat page with no session pre-selected

**Shared root cause — multi-session ambiguity:**
- The current resolution query `SELECT session_id FROM chat_message WHERE generated_content_id = X LIMIT 1` picks an arbitrary session when content has been discussed across multiple sessions. "Most recently active" is the correct semantic.

---

## Current Code Locations

| Concern | File | Lines |
|---|---|---|
| Queue button render | `frontend/src/routes/studio/queue.tsx` | 1193–1202 |
| Editor button render | `frontend/src/routes/studio/editor.tsx` | 276–282 |
| Editor nav (no params) | `frontend/src/routes/studio/editor.tsx` | 134–136 |
| sessionId subquery (queue list) | `backend/src/routes/queue/index.ts` | 295–299 |
| sessionId subquery (queue detail) | `backend/src/routes/queue/index.ts` | 628–635 |
| Route search validation | `frontend/src/routes/studio/generate.tsx` | 59–64 |
| Session load effect | `frontend/src/features/chat/components/ChatLayout.tsx` | 270–279 |
| Project load effect | `frontend/src/features/chat/components/ChatLayout.tsx` | 261–267 |
| Session creation endpoint | `backend/src/routes/chat/index.ts` | 99–144 |

---

## Data Model (relevant relationships)

```
chat_session (id UUID, userId, projectId)
    ↓ one-to-many
chat_message (id UUID, sessionId, role, content, generatedContentId nullable)
    ↓ many-to-one (nullable)
generated_content (id serial, userId, version, parentId)
    ↑ many-to-one
queue_item (id, userId, generatedContentId, status)
    ↑ many-to-one (nullable)
edit_project (id UUID, userId, generatedContentId nullable)
```

**Key fact:** One `generated_content` row can be referenced by `chat_message` rows in multiple different sessions. "Most recently active session" = the session whose `chat_session.updatedAt` is latest among all sessions that have a message referencing this content.

---

## Solution Design

### Principle

Replace every "show if session exists, navigate with what we have" pattern with **"always show, resolve lazily on click."**

A single shared backend endpoint — `POST /api/chat/sessions/resolve-for-content` — handles session resolution for any entry point. It:
1. Finds the **most recently active** session that has discussed this content
2. Falls back to creating a new session if none exists
3. Always returns `{ sessionId, projectId }`

The frontend navigates to `/studio/generate?sessionId=X&projectId=Y` uniformly. `ChatLayout` already reads both params — we just need to wire them through correctly.

---

## Backend Changes

### 1. Fix session resolution ordering in queue endpoints

**File:** `backend/src/routes/queue/index.ts`

Replace both subqueries (list and detail) to order by `chat_session.updated_at DESC` and also return `projectId`:

```typescript
// List query — replace existing sessionId subquery with:
sessionId: sql<string | null>`(
  SELECT cm.session_id
  FROM chat_message cm
  JOIN chat_session cs ON cm.session_id = cs.id
  WHERE cm.generated_content_id = ${queueItems.generatedContentId}
  ORDER BY cs.updated_at DESC
  LIMIT 1
)`,
projectId: sql<string | null>`(
  SELECT cs.project_id
  FROM chat_message cm
  JOIN chat_session cs ON cm.session_id = cs.id
  WHERE cm.generated_content_id = ${queueItems.generatedContentId}
  ORDER BY cs.updated_at DESC
  LIMIT 1
)`,

// Detail endpoint — replace existing sessionId lookup with:
const sessionRow = await db.execute(
  sql`SELECT cm.session_id, cs.project_id
      FROM chat_message cm
      JOIN chat_session cs ON cm.session_id = cs.id
      WHERE cm.generated_content_id = ${item.generatedContentId}
      ORDER BY cs.updated_at DESC
      LIMIT 1`
).then((r) => r[0] as { session_id: string; project_id: string } | undefined);

const sessionId = sessionRow?.session_id ?? null;
const projectId = sessionRow?.project_id ?? null;
```

Expose both `sessionId` and `projectId` in `QueueItem` and `QueueDetail` response shapes.

### 2. New endpoint: `POST /api/chat/sessions/resolve-for-content`

**File:** `backend/src/routes/chat/index.ts`

**Registration:** Register **before** the `/sessions/:id` route to prevent the `:id` wildcard capturing `"resolve-for-content"`.

**Middleware:** `rateLimiter("customer")`, `csrfMiddleware()`, `authMiddleware("user")`

**Request body:**
```typescript
{ generatedContentId: number }
```

**Response:**
```typescript
{ sessionId: string; projectId: string }
```

**Zod schema:**
```typescript
const resolveForContentSchema = z.object({
  generatedContentId: z.number().int().positive(),
});
```

**Logic:**

```
1. Auth check (authMiddleware already applied)

2. Look up most recently active session:
     SELECT cm.session_id, cs.project_id
     FROM chat_message cm
     JOIN chat_session cs ON cm.session_id = cs.id
     WHERE cm.generated_content_id = $generatedContentId
       AND cs.user_id = $userId
     ORDER BY cs.updated_at DESC
     LIMIT 1

3. If found → return { sessionId, projectId }

4. If not found (content was never discussed in chat):
   a. Find user's most recently updated project:
        SELECT id FROM projects
        WHERE user_id = $userId
        ORDER BY updated_at DESC LIMIT 1
   b. If no project → create one titled "My Project"
   c. Fetch generatedContent.generatedHook for session title
   d. Create new chat_session in that project:
        title: `Chat for "${generatedHook ?? "content"}"`
   e. Return { sessionId: newSession.id, projectId }
```

**Error cases:**
- `400` — invalid body (zod)
- `404` — `generatedContentId` does not exist or does not belong to user
- `500` — DB failure

---

## Frontend Changes

### 1. New shared `OpenChatButton` component

**File:** `frontend/src/routes/studio/_components/OpenChatButton.tsx`

Used by both Queue Detail and Editor. Handles the lazy-resolve flow.

```tsx
interface OpenChatButtonProps {
  sessionId: string | null;
  projectId: string | null;
  generatedContentId: number | null;
  className?: string;
}

function OpenChatButton({
  sessionId,
  projectId,
  generatedContentId,
  className,
}: OpenChatButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const [isResolving, setIsResolving] = useState(false);

  const handleClick = async () => {
    // Happy path: both already known
    if (sessionId && projectId) {
      void navigate({
        to: "/studio/generate",
        search: { sessionId, projectId },
      });
      return;
    }

    // Lazy resolve
    if (!generatedContentId) return;
    setIsResolving(true);
    try {
      const result = await authenticatedFetchJson<{
        sessionId: string;
        projectId: string;
      }>("/api/chat/sessions/resolve-for-content", {
        method: "POST",
        body: JSON.stringify({ generatedContentId }),
      });
      void navigate({
        to: "/studio/generate",
        search: { sessionId: result.sessionId, projectId: result.projectId },
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <button
      onClick={() => void handleClick()}
      disabled={isResolving || generatedContentId == null}
      className={className}
    >
      {isResolving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" />
      )}
      {t("studio_queue_detail_open_chat")}
    </button>
  );
}
```

### 2. Queue Detail Panel — replace conditional Link

**File:** `frontend/src/routes/studio/queue.tsx` (~line 1193)

**Before:**
```tsx
{sessionId && (
  <Link
    to="/studio/generate"
    search={{ sessionId } as Record<string, string>}
    className="..."
  >
    <ExternalLink className="h-3.5 w-3.5" />
    {t("studio_queue_detail_open_chat")}
  </Link>
)}
```

**After:**
```tsx
<OpenChatButton
  sessionId={detail.sessionId}
  projectId={detail.projectId}
  generatedContentId={content?.id ?? null}
  className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-studio-fg hover:border-overlay-lg transition-colors disabled:opacity-40"
/>
```

The button is now always rendered (no `{sessionId && ...}` guard). It is disabled only when `generatedContentId` is null.

### 3. Editor Projects List — replace navigate-with-no-params

**File:** `frontend/src/routes/studio/editor.tsx` (~line 125)

**Before:**
```tsx
const { mutate: openInAIChat, isPending: isLinking } = useMutation({
  mutationFn: async (proj: EditProject) => {
    if (proj.generatedContentId) return proj.generatedContentId;
    const res = await authenticatedFetchJson<{ generatedContentId: number }>(
      `/api/editor/${proj.id}/link-content`,
      { method: "POST" }
    );
    return res.generatedContentId;
  },
  onSuccess: () => {
    void navigate({ to: "/studio/generate" }); // ← no params
  },
});
```

**After:**
```tsx
const { mutate: openInAIChat, isPending: isLinking } = useMutation({
  mutationFn: async (proj: EditProject) => {
    // Step 1: ensure a generatedContentId exists
    let contentId = proj.generatedContentId;
    if (!contentId) {
      const res = await authenticatedFetchJson<{ generatedContentId: number }>(
        `/api/editor/${proj.id}/link-content`,
        { method: "POST" }
      );
      contentId = res.generatedContentId;
    }

    // Step 2: resolve (or create) the chat session for this content
    const result = await authenticatedFetchJson<{
      sessionId: string;
      projectId: string;
    }>("/api/chat/sessions/resolve-for-content", {
      method: "POST",
      body: JSON.stringify({ generatedContentId: contentId }),
    });

    return result;
  },
  onSuccess: (result) => {
    void navigate({
      to: "/studio/generate",
      search: { sessionId: result.sessionId, projectId: result.projectId },
    });
  },
});
```

The `openInAIChat` button render in the JSX (line 277) is unchanged — it already passes `proj` and checks `isLinking`.

### 4. Fix project context in ChatLayout

**File:** `frontend/src/features/chat/components/ChatLayout.tsx` (~line 270)

Extend the session-load effect to also sync `selectedProject`:

```typescript
useEffect(() => {
  if (sessionData && !sessionLoading) {
    setSelectedSession(sessionData.session);
    // Sync selected project from the loaded session when not already set
    if (!selectedProject && projects) {
      const project = projects.find(
        (p) => p.id === sessionData.session.projectId,
      );
      if (project) setSelectedProject(project);
    }
    setActiveReelRefs([]);
    setActiveContentId(null);
    setWorkspaceOpen(false);
    setRequestAudioForContentId(null);
  }
}, [sessionData, sessionLoading]);
```

### 5. Update route search validation to accept `projectId`

**File:** `frontend/src/routes/studio/generate.tsx`

```typescript
export const Route = createFileRoute("/studio/generate")({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: GeneratePage,
});
```

`ChatLayout` already reads `search.projectId` (line 263) but the route doesn't validate/type it — adding it here closes the type gap.

---

## Type Changes

### `QueueItem` type (`queue.tsx` ~line 60)
```typescript
// Add:
projectId: string | null;
```

### `QueueDetail` type (`queue.tsx` ~line 80)
```typescript
// Add:
projectId: string | null;
```

---

## Data Flows

### Queue Detail — happy path (session exists)
```
User clicks "Open AI Chat"
  → sessionId + projectId already in detail response (most recent session)
  → OpenChatButton navigates("/studio/generate?sessionId=X&projectId=Y")
  → ChatLayout reads sessionId → useChatSession(X) fetches session
  → sessionData sets selectedSession + selectedProject
  → Chat renders with prior conversation
```

### Queue Detail — edge case (no session yet)
```
User clicks "Open AI Chat"
  → sessionId is null, generatedContentId is known
  → POST /api/chat/sessions/resolve-for-content { generatedContentId }
  → Backend finds user's most recent project (or creates one)
  → Backend creates new session titled "Chat for [hook]"
  → Returns { sessionId, projectId }
  → navigate("/studio/generate?sessionId=X&projectId=Y")
  → [same as happy path from here]
```

### Editor — open in AI Chat
```
User clicks "AI Chat" on a project card
  → openInAIChat(proj) fires
  → If proj.generatedContentId is null:
      POST /api/editor/{proj.id}/link-content → gets contentId
  → POST /api/chat/sessions/resolve-for-content { generatedContentId: contentId }
  → Returns { sessionId, projectId }
  → navigate("/studio/generate?sessionId=X&projectId=Y")
  → ChatLayout loads session with prior messages (or fresh session if newly created)
```

### Direct URL navigation (no projectId in URL)
```
User navigates to /studio/generate?sessionId=X (e.g., copied from an old link)
  → ChatLayout: search.projectId is undefined → project effect does not fire
  → sessionData loads via useChatSession(X)
  → Session-load effect finds project from sessionData.session.projectId
  → setSelectedProject(project) — sidebar highlights correctly
```

---

## Edge Cases

| Case | Behavior |
|---|---|
| `generatedContentId` is null (malformed queue item) | Button rendered but disabled |
| Content discussed in multiple sessions | `resolve-for-content` picks most recently updated session (`ORDER BY cs.updated_at DESC`) |
| Resolve endpoint returns 500 | `isResolving` resets to false, button re-enabled; error propagates via existing mutation error handling |
| Session deleted between queue view and button click | `useChatSession` returns 404; TanStack Query error state, ChatLayout shows empty state — acceptable UX |
| User has no projects at all (new user, edge case) | Backend creates "My Project" automatically in step 4b |
| Editor project has no `generatedContentId` | `link-content` creates one first; then `resolve-for-content` runs — two sequential calls |
| `link-content` succeeds but `resolve-for-content` fails | Mutation enters error state; `generatedContentId` was created but no navigation — benign, content is queryable next time |
| User navigates to `/studio/generate?sessionId=X` directly (no projectId) | ChatLayout fix (#4 above) syncs project from `sessionData.session.projectId` |

---

## Translation Keys

No new keys needed. Reuses:
- `studio_queue_detail_open_chat` — queue button label
- `editor_open_in_ai_chat` — editor button label (existing, rendered separately in editor JSX)

---

## Non-Goals

- Adding the button to the queue **list** cards (only queue detail panel and editor projects list)
- Pre-populating the chat with content context when creating a new session from editor (session starts blank; content accessible via workspace panel)
- Deduplicating sessions across multiple content items in the same session

---

## Files to Touch

| File | Change |
|---|---|
| `backend/src/routes/chat/index.ts` | Add `POST /sessions/resolve-for-content` endpoint (register before `/sessions/:id`) |
| `backend/src/routes/queue/index.ts` | Fix session resolution ordering (`ORDER BY cs.updated_at DESC`); add `projectId` to list query and detail response |
| `frontend/src/routes/studio/queue.tsx` | Replace conditional `Link` with `<OpenChatButton>`; add `projectId` to `QueueItem`/`QueueDetail` types |
| `frontend/src/routes/studio/editor.tsx` | Extend `openInAIChat` mutation to call `resolve-for-content` and navigate with `sessionId + projectId` |
| `frontend/src/routes/studio/generate.tsx` | Add `projectId` to `validateSearch` |
| `frontend/src/features/chat/components/ChatLayout.tsx` | Extend session-load effect to sync `selectedProject` |
| `frontend/src/routes/studio/_components/OpenChatButton.tsx` | New shared component |
