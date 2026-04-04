# Plan 04: Fix Draft Invalidation Race Condition

**Fixes:** Bug 5 (draft doesn't appear in panel after streaming completes)  
**Risk:** Low — frontend-only, no schema changes  
**Depends on:** Nothing  
**Blocks:** Nothing

---

## Problem

When the AI finishes generating content, this sequence happens:

1. The tool handler saves the `generated_content` row to the DB and returns `{ contentId: X }`.
2. The AI SDK emits a `tool-output-available` SSE chunk with that content ID.
3. The frontend receives it and calls `setStreamingContentId(X)`.
4. `ContentWorkspace.tsx:56-60` fires an effect: `invalidateSessionDrafts(queryClient, sessionId)`.
5. TanStack Query immediately fires a refetch: `GET /api/chat/sessions/:id/content`.
6. **Race:** if the DB transaction hasn't fully committed by the time this request hits the DB, the new `generated_content` row is not yet visible. The response returns the old list — the new draft is missing.
7. The user sees the loading spinner stop with no new draft appearing.

This is particularly likely under load or with any replication lag. No retry or recovery logic exists.

---

## Current Code Location

**File:** `frontend/src/features/chat/components/ContentWorkspace.tsx:56-60`

```typescript
useEffect(() => {
  if (streamingContentId) {
    void invalidateSessionDrafts(queryClient, sessionId);
  }
}, [streamingContentId, sessionId, queryClient]);
```

**File:** `frontend/src/features/chat/hooks/use-streaming-content-side-effects.ts`

This hook fires after `streamingContentId` is set and handles cache invalidation for editor projects + queue.

---

## Fix: Optimistic Cache Insertion

Instead of immediately invalidating the cache (triggering a refetch that may race), **optimistically insert** the new draft into the existing TanStack Query cache using data the frontend already has from the SSE stream. Then invalidate in the background to eventually replace the optimistic entry with the authoritative DB record.

### What data is available on the frontend when `streamingContentId` fires

By the time `tool-output-available` fires, the full streamed text is accumulated in `streamingContent` (the state variable in `use-chat-stream.ts`). The AI always outputs the hook as the first significant piece of content, so it's available in the accumulated text.

However, parsing structured fields (hook, caption, hashtags) from raw streamed text is fragile. A better approach: the SSE stream emits `tool-input-start` before the tool runs, which carries the tool's input arguments. These are the exact field values the AI is saving.

### Implementation

**File:** `frontend/src/features/chat/streaming/sse-client.ts`

The `StreamIngestState` and `StreamIngestSetters` need to capture the last tool input for content tools:

```typescript
export type StreamIngestState = {
  accumulated: string;
  textDeltaCount: number;
  lastContentToolInput?: Record<string, unknown>; // ← ADD
};

export type StreamIngestSetters = {
  setStreamingContent: (content: string | null) => void;
  setIsSavingContent: (saving: boolean) => void;
  setStreamingContentId: (id: number | null) => void;
  setStreamError: (error: string | null) => void;
  setLastContentToolInput?: (input: Record<string, unknown>) => void; // ← ADD
};
```

In `processStreamSseLine`, capture the tool input when a content tool fires:

```typescript
case "tool-input-complete": {
  // fired when the full tool input JSON is available (before execution)
  if (CONTENT_WRITING_TOOLS.has(chunk.toolName as string)) {
    const input = chunk.input as Record<string, unknown>;
    state.lastContentToolInput = input;
    setters.setLastContentToolInput?.(input);
  }
  break;
}
```

Check which SSE chunk type carries tool input — may be `tool-input-start` with the full input attached, or a separate `tool-input-complete` event. Read the AI SDK docs or inspect the actual SSE events to confirm the exact chunk type name.

**File:** `frontend/src/features/chat/hooks/use-chat-stream.ts`

Add state for last tool input:

```typescript
const [lastContentToolInput, setLastContentToolInput] = useState<Record<string, unknown> | null>(null);
```

Pass `setLastContentToolInput` through `StreamIngestSetters`.

**File:** `frontend/src/features/chat/components/ContentWorkspace.tsx`

Replace the invalidation-only effect with an optimistic insertion + background invalidation:

```typescript
useEffect(() => {
  if (!streamingContentId) return;

  // Optimistically insert the new draft into the cache immediately
  // so the UI updates without waiting for the refetch
  queryClient.setQueryData(
    queryKeys.api.sessionDrafts(sessionId),
    (old: { drafts: SessionDraft[] } | undefined) => {
      const existing = old?.drafts ?? [];
      // Don't duplicate if already present
      if (existing.some((d) => d.id === streamingContentId)) {
        return old;
      }
      const optimistic: SessionDraft = {
        id: streamingContentId,
        version: 1,
        outputType: lastContentToolInput?.contentType as string ?? "full_script",
        status: "ready",
        generatedHook: lastContentToolInput?.hook as string ?? null,
        generatedScript: lastContentToolInput?.script as string ?? null,
        voiceoverScript: lastContentToolInput?.voiceoverScript as string ?? null,
        postCaption: lastContentToolInput?.postCaption as string ?? null,
        sceneDescription: lastContentToolInput?.sceneDescription as string ?? null,
        generatedMetadata: lastContentToolInput?.hashtags
          ? {
              hashtags: lastContentToolInput.hashtags as string[],
              cta: lastContentToolInput.cta as string ?? undefined,
              contentType: lastContentToolInput.contentType as string ?? undefined,
            }
          : null,
        createdAt: new Date().toISOString(),
      };
      return { drafts: [...existing, optimistic] };
    },
  );

  // Background invalidation — replaces optimistic data with authoritative DB record
  // Delay slightly to give the DB transaction time to commit
  const timeout = setTimeout(() => {
    void invalidateSessionDrafts(queryClient, sessionId);
  }, 300);

  return () => clearTimeout(timeout);
}, [streamingContentId, sessionId, queryClient, lastContentToolInput]);
```

The `lastContentToolInput` prop needs to be threaded from `use-chat-stream.ts` → `useChatLayout.ts` → `ContentWorkspace.tsx`. Add it to the props chain.

### Why the 300ms delay

The race condition window is the time between the tool returning and the DB transaction committing at the read replica level. 300ms is conservative — production transactions commit in under 100ms. The optimistic entry covers the UI immediately anyway, so the delay only affects when the authoritative data replaces the optimistic placeholder. If the refetch still races (returns empty), the optimistic entry stays visible until the next invalidation (e.g., when the session refetches after the full stream completes).

### Fallback: `onFinish` already invalidates

After the full AI response finishes, `use-chat-stream.ts` calls `invalidateChatSessionQuery(queryClient, sessionId)` which refetches the session + messages. Any draft that was optimistically inserted but missing from the DB at the time of the 300ms refetch will be picked up here. So the worst case is "new draft visible immediately (optimistic), then confirmed on session refetch." Not "new draft invisible."

---

## Files Changed Summary

| File | Change |
|---|---|
| `frontend/src/features/chat/streaming/sse-client.ts` | Add `lastContentToolInput` to state/setters, capture tool input on content tools |
| `frontend/src/features/chat/hooks/use-chat-stream.ts` | Add `lastContentToolInput` state, expose it |
| `frontend/src/features/chat/hooks/useChatLayout.ts` | Thread `lastContentToolInput` from stream hook to workspace |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Replace simple invalidation with optimistic insertion + delayed background invalidation |
