# Plan 02: Multi-Draft Per Message

**Fixes:** one assistant turn can create multiple drafts, but only the last one is structurally linked today  
**Risk:** Medium - schema migration plus repository/query changes  
**Depends on:** Nothing  
**Blocks:** Nothing

---

## Problem

`chat_message.generatedContentId` is a scalar foreign key. If a single assistant turn saves multiple `generated_content` rows, only the last one survives on the message row.

That breaks session draft discovery because `findChainTipDraftsForSession()` still walks message-linked content ids.

---

## Key Correction

This plan should be **additive first**, not destructive.

Dropping `chat_message.generatedContentId` immediately would create avoidable churn because current code still uses it in multiple places:

- `backend/src/domain/chat/chat.repository.ts`
- `backend/src/domain/content/content.repository.ts`
- `frontend/src/features/chat/components/ChatMessage.tsx`
- frontend chat types and API payloads that still expect a single `generatedContentId`

The safer rollout is:

1. add a junction table
2. backfill it from the existing scalar column
3. write both models for a transition period
4. move read paths to the junction table
5. only then consider removing the scalar column

---

## Schema Changes

### 1. Add `chat_message_draft`

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

```typescript
export const chatMessageDrafts = pgTable(
  "chat_message_draft",
  {
    id: serial("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    contentId: integer("content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull().default(0),
  },
  (t) => [
    uniqueIndex("chat_message_draft_message_content_idx").on(t.messageId, t.contentId),
    index("chat_message_draft_message_idx").on(t.messageId),
    index("chat_message_draft_content_idx").on(t.contentId),
  ],
);
```

### 2. Keep `chat_message.generatedContentId` during rollout

Do **not** drop the existing column in the first migration. Reinterpret it as:

- `latestGeneratedContentId` in behavior
- still physically stored in `generatedContentId` for compatibility

That preserves existing UI affordances while the many-to-many model is introduced.

### 3. Backfill

Migration SQL:

```sql
INSERT INTO chat_message_draft (message_id, content_id, slot)
SELECT id, generated_content_id, 0
FROM chat_message
WHERE generated_content_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## Backend Changes

### `createAssistantMessage`

**File:** `backend/src/domain/chat/chat.repository.ts`

Update the write path to accept all ids produced in the turn:

```typescript
createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  contentIds: number[];
}): Promise<void>
```

Write behavior:

- insert the assistant message row
- set `generatedContentId` on the message row to the **last** content id in `contentIds`, or `null` if none
- bulk insert all ids into `chat_message_draft`

This keeps legacy single-id consumers working while enabling complete history.

### `send-message.stream.ts`

Replace the single `savedContentId` accumulator with `savedContentIds: number[]`, preserving order and uniqueness.

### `findChainTipDraftsForSession`

**File:** `backend/src/domain/content/content.repository.ts`

Move session draft discovery to `chat_message_draft` joined through `chat_message`. This is the main behavioral fix.

### `findSessionByContentId`

**File:** `backend/src/domain/chat/chat.repository.ts`

Search via `chat_message_draft`, not only the scalar `chat_message.generatedContentId`.

---

## Frontend Impact

No frontend state model change is required for the initial migration.

That means:

- do **not** add `streamingContentIds` yet
- do **not** change SSE handling yet
- keep `streamingContentId` as the latest emitted content id for the current turn

Why: the user-visible bug is the missing draft in the session list, which is fixed by correcting backend persistence and session-draft queries.

If the product later needs message-level UI for "this assistant message created 3 drafts", add a separate API contract such as `generatedContentIds: number[]` at that time.

---

## Optional Cleanup Phase

Only after all reads are migrated and no UI depends on the scalar field:

1. expose `generatedContentIds` on message APIs if needed
2. migrate remaining single-id consumers
3. remove `chat_message.generatedContentId`

That cleanup is explicitly **not required** to fix the bug.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `chat_message_draft`; keep existing scalar column for compatibility |
| `backend/src/domain/chat/chat.repository.ts` | Write both scalar and junction rows; update content/session lookups |
| `backend/src/domain/chat/chat.service.ts` | Pass `contentIds` through save path |
| `backend/src/domain/chat/send-message.stream.ts` | Accumulate all saved content ids in order |
| `backend/src/domain/content/content.repository.ts` | Discover session drafts via `chat_message_draft` |
