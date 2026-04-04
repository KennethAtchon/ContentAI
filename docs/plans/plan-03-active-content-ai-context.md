# Plan 03: Session-Scoped Active Draft AI Context

**Fixes:** active-draft grounding is still thin, stuffed into the user message, and not validated against the session-owned draft set  
**Risk:** Low-medium - prompt composition and active-draft validation change on every send  
**Depends on:** Plan 02  
**Pairs with:** Plan 05

---

## Goal

Build AI grounding from the session-owned draft model instead of the old user-message wrapper.

After Plan 02:

- the session owns its drafts via `chat_session_content`
- `chat_session.activeContentId` is the current selected draft
- chat messages no longer carry draft ids

This plan should make the AI stack use that clean session-level model directly.

---

## Problem In Current Code

Today `backend/src/domain/chat/send-message.stream.ts` does this:

- calls `buildChatContext(...)`
- converts that context into `Context:\n...\n\nUser message: ...`
- sends the wrapped content as the final user message

That is weak for three reasons:

1. active draft grounding is not in the system prompt
2. the active draft snapshot is incomplete
3. `activeContentId` is treated as plain user-owned content, not as session-scoped content membership

With the new session-owned draft registry, the server should stop asking "does this user own content X?" and instead ask "is content X the session's active draft, or one of the drafts owned by this session?"

---

## Target Contract

For each send:

- `effectiveActiveContentId = request.activeContentId ?? session.activeContentId ?? undefined`
- if `request.activeContentId` is present, it must belong to the session
- `system` includes project context, attachment context, session draft inventory, and active-draft detail
- the final user message is the raw user text only

The AI should understand:

- which draft is active
- what other drafts already exist in the session
- that the active draft is the default target for iteration unless the user clearly references another draft

---

## Implementation

## 1. Resolve and validate active draft server-side

**File:** `backend/src/domain/chat/send-message.stream.ts`

Resolve:

```ts
const effectiveActiveContentId =
  activeContentId ?? session.activeContentId ?? undefined;
```

Then validate:

- if the request provided `activeContentId`, confirm it belongs to the session
- if the session has `activeContentId`, confirm it still belongs to the session
- if not, treat it as invalid session state and fall back to `undefined` or repair it intentionally

Do not treat arbitrary user-owned content as valid chat context for the session.

---

## 2. Split context builders by responsibility

**File:** `backend/src/domain/chat/chat.service.ts`

Replace the current monolithic `buildChatContext()` string builder with explicit helpers:

- `buildProjectAndAttachmentContext(...)`
- `buildSessionDraftInventoryContext(...)`
- `buildActiveContentContext(...)`

### `buildSessionDraftInventoryContext(...)`

This is the main change enabled by Plan 02.

It should provide a compact summary of session-owned drafts, for example:

- content id
- version
- status
- output type
- short hook preview
- whether the draft is active

This does not need full text bodies. It is inventory, not the full artifact.

### `buildActiveContentContext(...)`

This should provide the detailed snapshot for the effective active draft:

- `id`
- `version`
- `status`
- `outputType`
- `generatedHook`
- `postCaption`
- `generatedScript`
- `voiceoverScript`
- `sceneDescription`
- `generatedMetadata`
- `prompt`
- `parentId`
- `sourceReelId`

---

## 3. Token budget policy

The active draft can be large. Do not dump unbounded text into the system prompt.

Budget rules:

- include session draft inventory in compact form only
- include the active draft in richer detail
- truncate large fields with an explicit marker
- include the content id in truncation markers so the model knows what to fetch

Example marker:

```text
[truncated; call get_content with contentId 123 for the full record]
```

`voiceoverScript` should no longer be dropped just because the current formatter is thin. It is part of the active artifact and should be included subject to the same budget rules.

---

## 4. Compose the request correctly

Build the system prompt like this:

```ts
const system = [
  getChatSystemPrompt(),
  projectAndAttachmentContext,
  sessionDraftInventoryContext,
  activeContentContext,
].filter(Boolean).join("\n\n");
```

Then send:

```ts
messages: [
  ...history,
  { role: "user", content },
]
```

No more:

```text
Context:
...

User message: ...
```

The user message should be only what the user typed.

---

## 5. Tighten session-aware validation in chat service

**File:** `backend/src/domain/chat/chat.service.ts`

Add helpers that operate on session-owned membership, not just raw content ownership:

- `listSessionDraftsForContext(sessionId, userId)`
- `isContentAttachedToSession(sessionId, userId, contentId)`
- `findActiveDraftForSessionContext(sessionId, userId, effectiveActiveContentId)`

This ensures the active draft used for AI grounding is coherent with the workspace the user is actually in.

---

## 6. Update the base prompt

**File:** `backend/src/prompts/chat-generate.txt`

Add instructions that reflect the new architecture:

- the system message may include a **Session drafts** section
- the system message may include an **Active draft** section
- treat the active draft as the default target for edits and iteration
- if the active draft snapshot is truncated, call `get_content`
- do not assume messages themselves identify drafts

---

## 7. Keep the frontend request shape simple

The frontend can continue sending `activeContentId` on message send, but it is now just a session-scoped selection hint.

The backend remains authoritative by:

- falling back to `session.activeContentId`
- validating membership against the session

This means the client does not need to send any message-level content ids or draft provenance metadata.

---

## Tests

Add unit tests for:

- effective active id prefers request id over session id
- request `activeContentId` must belong to the session
- server falls back to `session.activeContentId` when request omits it
- session draft inventory formatter includes active marker and compact draft summaries
- active content formatter includes `voiceoverScript`
- oversized fields truncate with a marker that preserves the content id
- final user message is raw user text, not a wrapped context blob

---

## Files To Change

| File | Change |
|---|---|
| `backend/src/domain/chat/send-message.stream.ts` | Resolve effective active draft from session state and compose system/user messages correctly |
| `backend/src/domain/chat/chat.service.ts` | Replace `buildChatContext()` with session-aware context builders and membership validation |
| `backend/src/domain/chat/chat.repository.ts` | Add any missing session-membership reads needed for active-draft validation and draft inventory |
| `backend/src/prompts/chat-generate.txt` | Document session drafts and active-draft grounding |
| `backend/__tests__/unit/...` | Add validation and formatter tests |

---

## Acceptance Criteria

1. The AI request uses session-scoped draft context, not message-derived draft context.
2. The effective active draft is resolved from `request.activeContentId ?? session.activeContentId`.
3. Any requested active draft must belong to the session.
4. The system prompt includes a compact session draft inventory plus detailed active-draft context.
5. The final user message is the raw user text only.
6. The model can rely on the active draft as the default artifact for edits without needing message-level content ids.
