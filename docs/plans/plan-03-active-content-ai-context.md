# Plan 03: Active Content ID - Full AI Context

**Fixes:** the model receives only a thin active-draft summary and the grounding is appended as user text instead of system context  
**Risk:** Low-medium - prompt/context shape changes on every send  
**Depends on:** Plan 01 for server-side fallback to persisted active draft  
**Pairs with:** Plan 05

---

## Problem

Today `backend/src/domain/chat/send-message.stream.ts` builds a context string and prepends it to the user message. That has three weaknesses:

1. active draft grounding is not in the system prompt
2. the active draft snapshot is incomplete
3. there is no server-side fallback to `session.activeContentId` when the client omits the field

Current `buildChatContext()` also truncates the script aggressively and omits several fields that matter for iteration, including `voiceoverScript`.

---

## Target Contract

For each send:

- `system` = base prompt + project/attachment context + active-draft section
- final user message = raw user text only
- effective active id = `request.activeContentId ?? session.activeContentId ?? undefined`

The model should understand the active draft as the default artifact to iterate unless the user explicitly references another id.

---

## Implementation

### 1. Split context builders by responsibility

**File:** `backend/src/domain/chat/chat.service.ts`

Replace the single ad hoc `buildChatContext()` string builder with two helpers:

- `buildProjectAndAttachmentContext(...)`
- `buildActiveContentContext(...)`

`buildActiveContentContext(...)` should include:

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

### 2. Token budget policy

Do not dump unbounded text into the system prompt. Use a fixed character budget for long fields:

- prefer including `voiceoverScript` in full when possible
- include `generatedMetadata` as compact pretty JSON
- truncate oversized fields with an explicit marker, for example:

```text
[truncated; call get_content with contentId 123 for the full record]
```

### 3. Resolve the effective active id on the server

**File:** `backend/src/domain/chat/send-message.stream.ts`

```typescript
const effectiveActiveContentId =
  activeContentId ?? session.activeContentId ?? undefined;
```

### 4. Compose the request correctly

Use:

```typescript
const system = [
  getChatSystemPrompt(),
  projectAndAttachmentContext,
  activeContentContext,
].filter(Boolean).join("\n\n");
```

Then send:

```typescript
messages: [
  ...history,
  { role: "user", content },
]
```

No more `Context:\n...\n\nUser message:` wrapper.

### 5. Update the base prompt

**File:** `backend/src/prompts/chat-generate.txt`

Add a short instruction block:

- the system message may include an **Active draft** section
- treat that artifact as the default target for iterative edits
- if the snapshot is truncated, call `get_content` before major rewrites

---

## Tests

Add unit tests for:

- formatter includes `voiceoverScript`
- oversized fields truncate with a marker and preserve the content id
- `effectiveActiveContentId` prefers request id over session id
- server falls back to `session.activeContentId` when request omits it

---

## Files Changed Summary

| File | Change |
|---|---|
| `backend/src/domain/chat/chat.service.ts` | Split and expand context formatters |
| `backend/src/domain/chat/send-message.stream.ts` | Build system context correctly and resolve effective active id |
| `backend/src/domain/chat/chat.repository.ts` | Extend `findContentForChatContext` with any missing columns |
| `backend/src/prompts/chat-generate.txt` | Document active-draft system grounding |
| `backend/__tests__/unit/...` | Add formatter and fallback tests |
