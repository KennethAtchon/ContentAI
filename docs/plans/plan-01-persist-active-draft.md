# Plan 01: Persist Active Draft on Session

**Fixes:** Bug 2 (active draft resets on reload), Bug 4 (AI corrects its own conversation history)  
**Risk:** Low — additive schema change + small frontend wiring  
**Depends on:** Nothing  
**Blocks:** Plan 05 (UX rethink depends on this being reliable first)

---

## Problem

`activeContentId` is pure React state in `useChatLayout.ts:45`:

```typescript
const [activeContentId, setActiveContentId] = useState<number | null>(null);
```

On every session load or tab switch, it resets to `null`. `ContentWorkspace.tsx:77-81` then auto-activates the last draft (most recently created chain tip) as a fallback. This is wrong — the last draft is not necessarily the one the user was working on.

The AI receives the active draft as context on every message send (`send-message.stream.ts:74-79`). If the wrong draft is active, the AI iterates the wrong content — contradicting the conversation history already in the thread.

---

## Schema Change

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Add `activeContentId` to `chatSessions`:

```typescript
export const chatSessions = pgTable(
  "chat_session",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    activeContentId: integer("active_content_id").references(   // ← ADD
      () => generatedContent.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("chat_sessions_user_id_idx").on(t.userId),
    index("chat_sessions_project_id_idx").on(t.projectId),
  ],
);
```

`ON DELETE SET NULL` means if the referenced content is deleted, the session just loses its active anchor — safe fallback.

Run: `bun run db:generate && bun run db:migrate`

---

## Backend Changes

### 1. `IChatRepository` — add `activeContentId` to session return types

**File:** `backend/src/domain/chat/chat.repository.ts`

Every method that returns a session object needs `activeContentId: number | null` in its return type. Affected methods:

- `findSessionById` — return shape
- `findSessionByContentId` — return shape
- `createSession` — return shape
- `updateSession` — input data type + return shape
- `listSessions` — return shape

Add a new method:

```typescript
setActiveContentId(
  sessionId: string,
  userId: string,
  activeContentId: number | null,
): Promise<void>
```

Implementation:

```typescript
async setActiveContentId(
  sessionId: string,
  userId: string,
  activeContentId: number | null,
): Promise<void> {
  await this.db
    .update(chatSessions)
    .set({ activeContentId })
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    );
}
```

Update all existing `select` calls that return session rows to include:

```typescript
activeContentId: chatSessions.activeContentId,
```

### 2. `ChatService` — expose `setActiveContentId`

**File:** `backend/src/domain/chat/chat.service.ts`

Add:

```typescript
async setActiveContentId(
  userId: string,
  sessionId: string,
  activeContentId: number | null,
): Promise<void> {
  const session = await this.chatRepo.findSessionById(sessionId, userId);
  if (!session) throw Errors.notFound("Session");
  await this.chatRepo.setActiveContentId(sessionId, userId, activeContentId);
}
```

### 3. Sessions router — new PATCH endpoint

**File:** `backend/src/routes/chat/sessions.router.ts`

Add a route for patching session metadata. Validate with zod:

```typescript
const patchSessionSchema = z.object({
  activeContentId: z.number().nullable().optional(),
});

sessionsRouter.patch(
  "/:id",
  rateLimiter(),
  csrfMiddleware(),
  authMiddleware("user"),
  validateBody(patchSessionSchema),
  async (c) => {
    const auth = c.get("auth");
    const sessionId = c.req.param("id");
    const body = c.req.valid("json");

    if (body.activeContentId !== undefined) {
      await chatService.setActiveContentId(
        auth.user.id,
        sessionId,
        body.activeContentId,
      );
    }

    return c.json({ ok: true });
  },
);
```

### 4. `findSessionById` must return `activeContentId`

The frontend loads the session via `GET /api/chat/sessions/:id`. That route calls `chatService.findSessionById`. Ensure it returns `activeContentId` in the response body so the frontend can initialize state from it.

---

## Frontend Changes

### 1. Session type — add `activeContentId`

**File:** `frontend/src/features/chat/types/chat.types.ts`

Find the session object shape (wherever `ChatSession` or session response is typed) and add:

```typescript
activeContentId: number | null;
```

### 2. Chat service — add `patchSession`

**File:** `frontend/src/features/chat/services/chat.service.ts`

```typescript
patchSession(
  sessionId: string,
  data: { activeContentId?: number | null },
): Promise<{ ok: boolean }> {
  return authenticatedFetchJson(`/api/chat/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
```

### 3. `useChatLayout.ts` — initialize from session, persist on change

**File:** `frontend/src/features/chat/hooks/useChatLayout.ts`

**Current (line 45):**
```typescript
const [activeContentId, setActiveContentId] = useState<number | null>(null);
```

**Replace with:** initialize from the loaded session data once it arrives:

```typescript
const [activeContentId, setActiveContentId] = useState<number | null>(null);

// Initialize from persisted session value on load
useEffect(() => {
  const persisted = sessionData?.session?.activeContentId ?? null;
  if (persisted !== null) {
    setActiveContentId(persisted);
  }
}, [sessionData?.session?.id]); // only run when session identity changes, not on every re-render
```

Add a `handleSetActiveDraft` callback that both updates local state and persists to the backend:

```typescript
const handleSetActiveDraft = useCallback((contentId: number) => {
  setActiveContentId(contentId);
  if (sessionId) {
    void chatService.patchSession(sessionId, { activeContentId: contentId });
  }
}, [sessionId]);
```

Pass `handleSetActiveDraft` down instead of `setActiveContentId` wherever the active draft is changed by user interaction (DraftsList "Set Active" button, clicking a draft).

The reset effect (lines 96-102) — which fires when `sessionId` changes — should remain, but should NOT reset to `null`. Instead it should let the `sessionData` initialization effect above restore the correct value for the new session:

```typescript
useEffect(() => {
  if (prevSessionIdForResetRef.current === sessionId) return;
  prevSessionIdForResetRef.current = sessionId;
  // Don't reset activeContentId here — let the session load effect restore it
  setWorkspaceOpen(false);
  setRequestAudioForContentId(null);
}, [sessionId]);
```

### 4. `ContentWorkspace.tsx` — change auto-activate fallback

**File:** `frontend/src/features/chat/components/ContentWorkspace.tsx`

**Current (lines 77-81):**
```typescript
useEffect(() => {
  if (!isLoading && !activeContentId && drafts.length > 0) {
    onActiveContentChange(drafts[drafts.length - 1].id);
  }
}, [isLoading, drafts.length, activeContentId, onActiveContentChange]);
```

This should only fire for brand-new sessions that have never had an active draft set — i.e., when `session.activeContentId` is null AND the session has just been loaded:

```typescript
useEffect(() => {
  if (!isLoading && !activeContentId && drafts.length > 0) {
    // Fallback: session has no persisted active draft (first ever use), pick latest
    onActiveContentChange(drafts[drafts.length - 1].id);
  }
}, [isLoading, drafts.length, activeContentId, onActiveContentChange]);
```

The logic is unchanged, but it will now only fire in the genuine "no active draft ever set" case because `activeContentId` is initialized from `session.activeContentId` before the drafts load.

---

## Auto-advance After New Content is Generated

When a content tool saves a new draft, `streamingContentId` fires in `ContentWorkspace.tsx:63-67`:

```typescript
useEffect(() => {
  if (streamingContentId) {
    onActiveContentChange(streamingContentId);
  }
}, [streamingContentId, onActiveContentChange]);
```

`onActiveContentChange` is wired to `handleSetActiveDraft` from step 3 above. So every time the AI generates new content, the new draft is automatically persisted as the session's active draft. No extra wiring needed.

---

## What Changes at the AI Context Layer

No changes needed to `chat.service.ts:buildChatContext()` or `send-message.stream.ts`. The `activeContentId` passed to the stream is already sourced from `useChatLayout.activeContentId`, which is now correctly initialized from and synced to the DB. The AI will receive the right draft on every message.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `activeContentId` column to `chatSessions` |
| `backend/src/domain/chat/chat.repository.ts` | Add `setActiveContentId()`, update all session return shapes |
| `backend/src/domain/chat/chat.service.ts` | Add `setActiveContentId()` |
| `backend/src/routes/chat/sessions.router.ts` | Add `PATCH /:id` route |
| `frontend/src/features/chat/types/chat.types.ts` | Add `activeContentId` to session type |
| `frontend/src/features/chat/services/chat.service.ts` | Add `patchSession()` |
| `frontend/src/features/chat/hooks/useChatLayout.ts` | Initialize from session, add `handleSetActiveDraft`, fix reset effect |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Fallback auto-activate only for brand-new sessions |
