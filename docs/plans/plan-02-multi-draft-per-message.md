# Plan 02: Multi-Draft Per Message (Junction Table)

**Fixes:** Bug 3 (one assistant message structurally capped at one draft)  
**Risk:** Medium — DB migration + query rewrite + frontend SSE handling  
**Depends on:** Nothing  
**Blocks:** Nothing

---

## Problem

`chat_messages.generatedContentId` is a scalar `integer`. When the AI calls a content tool (e.g. `save_content`) more than once in a single response turn, the `savedContentId` variable in `send-message.stream.ts:89-100` is overwritten each time. Only the last content ID is persisted to `chat_messages`. All prior `generated_content` records created in the same turn are orphaned — they exist in the DB but are never reachable from `findChainTipDraftsForSession()`, so they never appear in the drafts panel.

---

## Schema Changes

### 1. New table: `chat_message_drafts`

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
    slot: smallint("slot").notNull().default(0), // ordering within the message turn
  },
  (t) => [
    uniqueIndex("chat_message_drafts_message_content_idx").on(t.messageId, t.contentId),
    index("chat_message_drafts_message_id_idx").on(t.messageId),
    index("chat_message_drafts_content_id_idx").on(t.contentId),
  ],
);
```

Add Drizzle relations:

```typescript
export const chatMessageDraftsRelations = relations(chatMessageDrafts, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatMessageDrafts.messageId],
    references: [chatMessages.id],
  }),
  content: one(generatedContent, {
    fields: [chatMessageDrafts.contentId],
    references: [generatedContent.id],
  }),
}));
```

Update `chatMessagesRelations` to include the new junction:

```typescript
export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  session: one(chatSessions, { ... }),
  generatedContent: one(generatedContent, { ... }), // keep for now — see migration note
  attachments: many(messageAttachments),
  drafts: many(chatMessageDrafts), // ← ADD
}));
```

### 2. Remove `chat_messages.generatedContentId`

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

Remove the column from the table definition:

```typescript
// DELETE this line from chatMessages:
generatedContentId: integer("generated_content_id").references(
  () => generatedContent.id,
  { onDelete: "set null" },
),
```

Remove the relation from `chatMessagesRelations`:

```typescript
// DELETE:
generatedContent: one(generatedContent, {
  fields: [chatMessages.generatedContentId],
  references: [generatedContent.id],
}),
```

**Migration note:** Before dropping the column, a data migration is needed to backfill `chat_message_drafts` from existing `chat_messages.generatedContentId` values. The migration:

```sql
INSERT INTO chat_message_draft (message_id, content_id, slot)
SELECT id, generated_content_id, 0
FROM chat_message
WHERE generated_content_id IS NOT NULL;

ALTER TABLE chat_message DROP COLUMN generated_content_id;
```

Run: `bun run db:generate && bun run db:migrate`

---

## Backend Changes

### 1. `IChatRepository` — new methods for message drafts

**File:** `backend/src/domain/chat/chat.repository.ts`

Replace `createAssistantMessage` signature:

**Old:**
```typescript
createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  generatedContentId: number | null;
}): Promise<void>
```

**New:**
```typescript
createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  contentIds: number[]; // all content IDs produced in this turn
}): Promise<void>
```

Implementation — insert the message then bulk-insert the junction rows:

```typescript
async createAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  contentIds: number[];
}): Promise<void> {
  await this.db.insert(chatMessages).values({
    id: data.id,
    sessionId: data.sessionId,
    role: "assistant",
    content: data.content,
    // no generatedContentId column anymore
  });

  if (data.contentIds.length > 0) {
    await this.db.insert(chatMessageDrafts).values(
      data.contentIds.map((contentId, slot) => ({
        messageId: data.id,
        contentId,
        slot,
      })),
    );
  }
}
```

### 2. `ChatService.saveAssistantMessage` — update call

**File:** `backend/src/domain/chat/chat.service.ts`

Find `saveAssistantMessage` and update the `createAssistantMessage` call to pass `contentIds` instead of `generatedContentId`:

```typescript
async saveAssistantMessage(data: {
  id: string;
  sessionId: string;
  content: string;
  contentIds: number[]; // ← was: generatedContentId: number | null
}): Promise<void> {
  await this.chatRepo.createAssistantMessage({
    id: data.id,
    sessionId: data.sessionId,
    content: data.content,
    contentIds: data.contentIds,
  });
  await this.chatRepo.updateSessionTimestamp(data.sessionId);
}
```

### 3. `send-message.stream.ts` — collect all content IDs, not just the last

**File:** `backend/src/domain/chat/send-message.stream.ts`

**Old (lines 89-100):**
```typescript
let savedContentId: number | null = null;
const toolContext: ToolContext = {
  get savedContentId() { return savedContentId || undefined; },
  set savedContentId(value) { savedContentId = value || null; },
};
```

**New — collect all IDs in order:**
```typescript
const savedContentIds: number[] = [];
const toolContext: ToolContext = {
  get savedContentId() { return savedContentIds[savedContentIds.length - 1] || undefined; },
  set savedContentId(value: number | undefined) {
    if (value && !savedContentIds.includes(value)) {
      savedContentIds.push(value);
    }
  },
};
```

**In `onFinish` (lines 144-149):**
```typescript
// Old:
await chatService.saveAssistantMessage({
  id: assistantMessageId,
  sessionId,
  content: text,
  generatedContentId: savedContentId,
});

// New:
await chatService.saveAssistantMessage({
  id: assistantMessageId,
  sessionId,
  content: text,
  contentIds: savedContentIds,
});
```

### 4. `ToolContext` interface — update type

**File:** `backend/src/domain/chat/chat-tools.ts`

The `savedContentId` getter/setter already works since we're keeping the property name. No interface change needed — the setter now appends to an array behind the scenes but the tool-facing API (get/set `savedContentId`) stays the same. Tools don't need to know about the array.

### 5. `ContentRepository.findChainTipDraftsForSession` — rewrite query

**File:** `backend/src/domain/content/content.repository.ts`

This is the most impactful query change. Currently it traces content IDs through `chat_messages.generatedContentId`. It must now join through `chat_message_drafts`.

**Old pattern:**
```typescript
const messageRows = await this.db
  .select({ generatedContentId: chatMessages.generatedContentId })
  .from(chatMessages)
  .where(and(
    eq(chatMessages.sessionId, sessionId),
    eq(chatMessages.role, "assistant"),
    isNotNull(chatMessages.generatedContentId),
  ));
```

**New pattern:**
```typescript
const draftRows = await this.db
  .select({ contentId: chatMessageDrafts.contentId })
  .from(chatMessageDrafts)
  .innerJoin(chatMessages, eq(chatMessageDrafts.messageId, chatMessages.id))
  .where(
    and(
      eq(chatMessages.sessionId, sessionId),
      eq(chatMessages.role, "assistant"),
    )
  );

const contentIds = [...new Set(draftRows.map((r) => r.contentId))];
```

The rest of the query (fetching records, finding chain tips, sorting) is unchanged.

### 6. `ChatRepository.findSessionByContentId` — update join

**File:** `backend/src/domain/chat/chat.repository.ts`

This method finds a session by searching for a message with the given `generatedContentId`. It must now join through `chat_message_drafts`:

```typescript
async findSessionByContentId(userId: string, contentId: string) {
  const [session] = await this.db
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      projectId: chatSessions.projectId,
      title: chatSessions.title,
      activeContentId: chatSessions.activeContentId,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .innerJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
    .innerJoin(chatMessageDrafts, eq(chatMessages.id, chatMessageDrafts.messageId))
    .where(
      and(
        eq(chatMessageDrafts.contentId, Number(contentId)),
        eq(chatSessions.userId, userId),
      ),
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  return session;
}
```

---

## Frontend Changes

### 1. SSE client — accumulate multiple `streamingContentId` values

**File:** `frontend/src/features/chat/streaming/sse-client.ts`

Currently, `setStreamingContentId` is called with a single number, replacing the previous value. With multi-draft support, each `tool-output-available` chunk in a single turn can carry a different `contentId`.

The `StreamIngestSetters` type and `drainSseStreamIntoIngest` both need to support multiple IDs emitted across one stream turn. The simplest approach: keep `streamingContentId` as the most-recently-emitted ID (same as now for single-draft), but also maintain a `streamingContentIds: number[]` for multi-draft contexts.

In `use-chat-stream.ts`, add a parallel `streamingContentIds` state:

```typescript
const [streamingContentId, setStreamingContentId] = useState<number | null>(null);
const [streamingContentIds, setStreamingContentIds] = useState<number[]>([]);
```

In the SSE `tool-output-available` handler:
```typescript
case "tool-output-available": {
  const output = chunk.output as { contentId?: number };
  if (output?.contentId) {
    setStreamingContentId(output.contentId);
    setStreamingContentIds((prev) =>
      prev.includes(output.contentId!) ? prev : [...prev, output.contentId!]
    );
  }
  break;
}
```

Reset `streamingContentIds` alongside `streamingContentId` when a new stream starts.

### 2. `ContentWorkspace.tsx` — invalidate on any new streaming content ID

**File:** `frontend/src/features/chat/components/ContentWorkspace.tsx`

The invalidation effect already runs when `streamingContentId` changes. With multi-draft, this still works — it fires after each tool call within the turn. No change needed unless we want to batch the invalidations (optimization, not required).

The auto-activate effect (`onActiveContentChange(streamingContentId)`) should still use the last content ID in the turn — which `streamingContentId` already represents.

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `chatMessageDrafts` table, remove `generatedContentId` from `chatMessages`, update relations |
| `backend/src/domain/chat/chat.repository.ts` | Update `createAssistantMessage`, update `findSessionByContentId` |
| `backend/src/domain/chat/chat.service.ts` | Update `saveAssistantMessage` signature |
| `backend/src/domain/chat/send-message.stream.ts` | Collect all `savedContentIds`, pass array to `saveAssistantMessage` |
| `backend/src/domain/content/content.repository.ts` | Rewrite `findChainTipDraftsForSession` to join through `chat_message_drafts` |
| `frontend/src/features/chat/streaming/sse-client.ts` | Add `streamingContentIds` accumulator |
| `frontend/src/features/chat/hooks/use-chat-stream.ts` | Add `streamingContentIds` state, expose it |
