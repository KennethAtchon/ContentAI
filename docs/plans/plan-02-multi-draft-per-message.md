# Plan 02: Session-Owned Draft Registry

**Fixes:** `/generate` derives drafts by scanning assistant messages instead of the session owning its drafts  
**Risk:** Medium - schema change plus chat/session contract cleanup across backend and frontend  
**Depends on:** Plan 01  
**Blocks:** Plan 03, Plan 05

---

## Goal

Delete the message-derived draft model and replace it with a session-owned draft registry.

The target architecture is:

- `chat_session` owns the set of drafts available in that session
- `chat_session.activeContentId` is the selected draft
- chat messages are conversation history only
- draft creation during chat updates session state directly
- the workspace reads drafts from session-owned data, not from message history

If a chat session creates three drafts, the session should know that directly. We should never need to scan old messages to discover what the session contains.

---

## Problem In Current Code

Today the workspace gets drafts from `GET /api/chat/sessions/:id/content`, but the backend derives that list by scanning assistant messages:

- `frontend/src/features/chat/hooks/use-session-drafts.ts` calls `/sessions/:id/content`
- `backend/src/routes/chat/sessions.router.ts` delegates to `findChainTipDraftsForSession()`
- `backend/src/domain/content/content.repository.ts` loads `chat_message.generatedContentId`
- `backend/src/domain/chat/chat.repository.ts::findSessionByContentId()` also searches through `chat_message.generatedContentId`

This is the wrong ownership model.

The current pattern means:

1. the session does not truly know its drafts
2. draft membership is inferred from historical messages
3. multi-draft assistant turns are fundamentally awkward because message rows only store one `generatedContentId`
4. message rendering and workspace state are coupled to artifact persistence in a way that makes the model harder to reason about

This is exactly backwards. A session should own its draft workspace. Messages should not be the source of truth for what exists in that workspace.

---

## New Model

Split responsibilities cleanly.

### Session owns drafts

This answers:

- which drafts belong to this chat session?
- which draft is active?
- which drafts should appear in the `/generate` workspace?

This belongs to `chat_session` plus a new session-to-content join table.

### Messages own conversation only

This answers:

- what did the user ask?
- what did the assistant say?
- what reels and assets were attached to the message?

Messages do not need to know which generated content ids they "work on".

---

## Schema Rewrite

### 1. Drop `chat_message.generatedContentId`

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Remove the column completely.

We are in development mode. Do not preserve this as a compatibility field.

### 2. Add `chat_session_content`

Add a real session-owned draft membership table:

```ts
export const chatSessionContent = pgTable(
  "chat_session_content",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_session_content_session_content_idx").on(
      t.sessionId,
      t.contentId,
    ),
    index("chat_session_content_session_idx").on(t.sessionId),
    index("chat_session_content_content_idx").on(t.contentId),
  ],
);
```

This table answers one question only: which generated content rows belong to this session?

### 3. Add relations

- `chatSessionsRelations.contents = many(chatSessionContent)`
- `chatSessionContent` relates to `chatSessions` and `generatedContent`

### 4. Migration

Migration stance:

- create `chat_session_content`
- backfill it from the current message-derived world
- drop `chat_message.generated_content_id`

Backfill SQL sketch:

```sql
INSERT INTO chat_session_content (session_id, content_id)
SELECT DISTINCT session_id, generated_content_id
FROM chat_message
WHERE generated_content_id IS NOT NULL;

ALTER TABLE chat_message DROP COLUMN generated_content_id;
```

This is a one-time migration to get us out of the old model.

---

## Backend Rewrite

## Repository Contract Changes

### `ChatRepository`

Add session-owned content methods:

```ts
attachContentToSession(
  sessionId: string,
  userId: string,
  contentId: number,
): Promise<void>;

listSessionContentIds(
  sessionId: string,
  userId: string,
): Promise<number[]>;

findSessionByContentId(
  userId: string,
  contentId: string,
): Promise<...>;
```

`findSessionByContentId()` should now search:

- `chat_session.activeContentId`
- `chat_session_content.contentId`

It should stop searching message rows entirely.

### `createAssistantMessage`

Change from:

```ts
createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  generatedContentId: number | null;
}): Promise<void>;
```

To:

```ts
createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
}): Promise<void>;
```

Assistant messages should persist text only.

### `listMessages`

Stop returning message-level `generatedContentId`.

Frontend `ChatMessage` should no longer receive it because it no longer exists conceptually.

---

## Draft Membership Write Path

## The session should be updated when content is created, not later by scanning history

This is the core behavioral change.

Today content-creating tools write `generated_content`, and later the system infers draft membership through messages. Replace that with direct session updates at content creation time.

### `ToolContext` must know the session

**File:** `backend/src/domain/chat/chat-tools.ts`

Add `sessionId` to `ToolContext`.

Every content-creating tool should, after a successful insert:

1. attach the new `contentId` to the session
2. advance `chat_session.activeContentId` to that new `contentId`
3. register the id for streaming/UI side effects

This should happen in:

- `save_content`
- `iterate_content`
- `edit_content_field`

The session becomes the source of truth the moment the draft is created.

### Why update `activeContentId` on the server?

Because the backend is the system actually creating the new draft.

Relying on the client to notice a streamed `contentId` and then patch the session later is fragile. The server should persist the new active draft as part of the same logical operation that created it.

Client-side active-draft updates can remain for responsiveness, but they should be mirroring persisted server state, not inventing it.

---

## Session Draft Query Rewrite

### Rewrite `findChainTipDraftsForSession`

**File:** `backend/src/domain/content/content.repository.ts`

Stop scanning `chat_message`.

New algorithm:

1. load all session-owned `contentId`s from `chat_session_content`
2. dedupe ids
3. resolve each id to the current chain tip in `generated_content`
4. dedupe resolved tips
5. return the unique tips ordered newest-first or oldest-first, whichever the workspace expects, but do it intentionally and document it

Important detail:

The session table should store any version that was ever active in the session. The drafts endpoint should still return current chain tips for those chains, because the workspace cares about current usable drafts, not stale ancestors.

### `GET /sessions/:id/content`

This route can stay, but now it finally means what it says:

- fetch drafts owned by the session
- do not reconstruct them from messages

---

## Streaming Rewrite

## Keep multi-draft stream tracking, but make it ephemeral

We still need to support more than one draft being created in a single assistant turn. The difference is that streamed content ids are now only for UI updates and side effects, not for message persistence.

### Backend stream state

**File:** `backend/src/domain/chat/send-message.stream.ts`

Replace:

```ts
let savedContentId: number | null = null;
```

With:

```ts
const savedContentIds: number[] = [];
```

`savedContentIds` is used for:

- emitting multiple `contentId` events over SSE
- editor auto-link side effects
- queue invalidation side effects

It is not written onto the assistant message.

### Frontend stream state

**Files:**

- `frontend/src/features/chat/hooks/use-chat-stream.ts`
- `frontend/src/features/chat/streaming/sse-client.ts`
- `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts`

Replace single-id state with:

```ts
streamingContentIds: number[];
latestStreamingContentId: number | null;
```

The frontend should:

- append each new streamed `contentId`
- invalidate drafts/query state for the session
- auto-create editor projects for each newly created content id
- optionally mirror `activeContentId` locally to the latest streamed id for immediate UI response

Again: this array is an in-flight stream concern, not persisted message state.

---

## Frontend Rewrite

## Remove message-level draft identity

### `frontend/src/features/chat/types/chat.types.ts`

Remove:

```ts
generatedContentId?: number;
```

from `ChatMessage`.

Messages should contain:

- text
- role
- timestamps
- reel refs / media refs

and nothing draft-specific.

### `ChatMessage.tsx`

Current message rendering uses `message.generatedContentId` or `streamingContentId` to show:

- audio status
- draft-specific action chips
- content-specific follow-up actions

That coupling should be removed.

Draft-aware UI should move to places that are actually session/draft aware:

- the workspace panel
- the active-draft indicator near the composer
- any session-level draft picker

`ChatMessage` should render the conversation, not pretend it owns draft state.

### `ContentWorkspace.tsx`

This component already thinks in terms of `drafts` plus `activeContentId`. That is the right abstraction. Keep that and change only the source of `drafts`:

- drafts come from session-owned content membership
- auto-selection follows `activeContentId`
- no message scan assumptions remain

---

## Session Creation and Session Resolution

### `findOrCreateSessionForContent`

When creating a brand-new session from an existing content id:

1. create the session
2. seed `chat_session.activeContentId` with that content id
3. insert a `chat_session_content` row for that content id

If an existing session is found for that content id, it should be found through `chat_session_content`, not message history.

### Session ownership validation

Whenever the client tries to set `activeContentId`, the backend should validate:

- the content exists
- it belongs to the user
- it is already attached to the session

If it is not attached to the session, reject the update rather than letting session state drift.

This becomes important for Plan 03 because active-draft AI context should be session-scoped, not just user-owned-content scoped.

---

## Explicitly Delete These Old Patterns

This rewrite should remove:

- `chat_message.generatedContentId`
- scanning `chat_message` to build the workspace drafts list
- `findSessionByContentId()` joins through `chat_message`
- message-level draft UI assumptions in `ChatMessage.tsx`
- the idea that a message is the owner of generated content membership

That pattern should be considered dead after this plan lands.

---

## Files To Change

| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `chat_session_content`; remove `chat_message.generatedContentId`; add relations |
| `backend/src/domain/chat/chat.repository.ts` | Add session-content membership methods; stop persisting message draft ids; update session resolution |
| `backend/src/domain/chat/chat.service.ts` | Attach content to session and validate active draft membership |
| `backend/src/domain/chat/send-message.stream.ts` | Track multiple saved content ids for stream side effects only |
| `backend/src/domain/chat/chat-tools.ts` | Give tools `sessionId`; attach created drafts to session and advance active draft server-side |
| `backend/src/domain/content/content.repository.ts` | Build session drafts from `chat_session_content` and resolve chain tips there |
| `backend/src/routes/chat/sessions.router.ts` | Keep `/sessions/:id/content`, but back it with session-owned membership |
| `frontend/src/features/chat/types/chat.types.ts` | Remove `generatedContentId` from `ChatMessage` |
| `frontend/src/features/chat/components/ChatMessage.tsx` | Remove draft-specific ownership assumptions |
| `frontend/src/features/chat/hooks/use-chat-stream.ts` | Track multiple streamed content ids ephemerally |
| `frontend/src/features/chat/streaming/sse-client.ts` | Append ids instead of replacing one |
| `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts` | Run side effects for each new streamed content id |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Keep session-centered draft handling, but with real session-owned data |

---

## Acceptance Criteria

1. The drafts shown in `/generate` come from session-owned membership, not from scanning chat messages.
2. A single assistant turn can create multiple drafts and all of them are attached to the session immediately.
3. Assistant messages persist conversation text only and do not store draft ids.
4. `chat_session.activeContentId` is updated server-side when chat creates a new draft.
5. `findSessionByContentId()` resolves through session-owned membership, not message history.
6. The workspace can switch drafts cleanly because the session owns both the active pointer and the draft set.
7. No backend read path depends on `chat_message.generatedContentId`.
