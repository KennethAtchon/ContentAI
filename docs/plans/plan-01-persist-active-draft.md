# Plan 01: Persist Active Draft on Session

**Fixes:** active draft resets on reload; server and client can disagree about which draft is active  
**Risk:** Low-medium - additive schema change plus hydration/persistence wiring  
**Depends on:** Nothing  
**Blocks:** Plan 05

---

## Problem

`activeContentId` is currently local React state in `frontend/src/features/chat/hooks/useChatLayout.ts`. On session switches it is explicitly reset to `null`, and `ContentWorkspace.tsx` then falls back to the latest draft.

That creates three correctness problems:

1. Reloading a session loses the user's working draft.
2. Switching sessions briefly shows the wrong draft until the user re-selects one.
3. Sessions created from an existing content item do not automatically carry that content forward as the active draft anchor.

---

## Decisions

### 1. `chat_session` becomes the source of truth

Add `activeContentId` to `chat_session` with `ON DELETE SET NULL`.

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

### 2. Session APIs must return the persisted active id everywhere

Any route that returns a session object should include `activeContentId`, especially:

- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id`
- `POST /api/chat/sessions`
- `POST /api/chat/sessions/resolve-for-content`

### 3. Creating or resolving a session from content should seed the active draft

When `findOrCreateSessionForContent()` creates a brand-new session for a specific `generated_content` row, that row should become `session.activeContentId` immediately. Otherwise the first load of the new session starts in an ambiguous state.

### 4. Client hydration must be keyed to session identity, not every refetch

Do not run `setActiveContentId(sessionData.session.activeContentId)` on every query refresh. That would overwrite a local user change if the PATCH is still in flight.

Hydrate only when the active `sessionId` changes, using a ref such as:

```typescript
const hydratedSessionIdRef = useRef<string | null>(null);

useEffect(() => {
  const session = sessionData?.session;
  if (!session) return;
  if (hydratedSessionIdRef.current === session.id) return;
  hydratedSessionIdRef.current = session.id;
  setActiveContentId(session.activeContentId ?? null);
}, [sessionData?.session]);
```

### 5. Persist explicit user changes, but keep the UI responsive

When the user activates a draft, update local state immediately and persist in the background. If persistence fails, keep the local selection for the current session and show a toast; do not silently revert.

---

## Backend Changes

### Schema

Add:

```typescript
activeContentId: integer("active_content_id").references(
  () => generatedContent.id,
  { onDelete: "set null" },
),
```

Run:

```bash
bun run db:generate
bun run db:migrate
```

### Repository

**File:** `backend/src/domain/chat/chat.repository.ts`

- Include `activeContentId` in all session return shapes.
- Add:

```typescript
setActiveContentId(
  sessionId: string,
  userId: string,
  activeContentId: number | null,
): Promise<void>
```

### Service

**File:** `backend/src/domain/chat/chat.service.ts`

- Add `setActiveContentId(userId, sessionId, activeContentId)`.
- In `findOrCreateSessionForContent()`, when creating a new session from a content id, persist that content id as the session's `activeContentId`.

### Router

**File:** `backend/src/routes/chat/sessions.router.ts`

Add a metadata update path. Either of these is acceptable, but pick one and use it consistently:

- extend the existing `PUT /sessions/:id` body to allow `activeContentId`
- add a dedicated `PATCH /sessions/:id` endpoint for partial metadata updates

The important contract is that title updates and active-draft updates do not require separate frontend fetch models.

---

## Frontend Changes

### `useChatLayout.ts`

Replace the raw setter usage with an owned handler:

```typescript
const handleSetActiveContentId = useCallback((contentId: number | null) => {
  setActiveContentId(contentId);
  if (!sessionId) return;
  void chatService.updateSessionMetadata(sessionId, { activeContentId: contentId })
    .catch(() => toast.error(t("studio_chat_active_draft_save_failed")));
}, [sessionId, t]);
```

Also update the session-switch reset effect:

- keep `workspaceOpen` and `requestAudioForContentId` resets
- do **not** permanently reset `activeContentId` to `null` after the new session has loaded
- instead clear transient local state, then let the per-session hydration effect restore the persisted value

### `ContentWorkspace.tsx`

Keep the fallback auto-activation, but only for sessions whose persisted `activeContentId` is `null`. That means the component needs access to the hydrated session value, not just the derived local state.

### Types / services

- add `activeContentId: number | null` to `ChatSession`
- add a chat service method for updating session metadata

---

## Rollout Notes

- This is additive and safe to ship before Plans 02-05.
- After this lands, all downstream plans should treat `session.activeContentId` as the canonical persisted anchor.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `chat_session.active_content_id` |
| `backend/src/domain/chat/chat.repository.ts` | Return and update `activeContentId` |
| `backend/src/domain/chat/chat.service.ts` | Add setter; seed active draft when session is created from content |
| `backend/src/routes/chat/sessions.router.ts` | Accept active-draft metadata updates |
| `frontend/src/features/chat/types/chat.types.ts` | Add `activeContentId` to `ChatSession` |
| `frontend/src/features/chat/services/chat.service.ts` | Add session metadata update call |
| `frontend/src/features/chat/hooks/useChatLayout.ts` | Hydrate per session and persist changes safely |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Restrict fallback auto-activation to genuinely unset sessions |
