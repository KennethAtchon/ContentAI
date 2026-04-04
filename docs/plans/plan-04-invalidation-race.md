# Plan 04: Fix Draft Invalidation Race Condition

**Fixes:** newly created draft sometimes does not appear in the sidebar immediately after streaming  
**Risk:** Low - frontend-only  
**Depends on:** Nothing  
**Blocks:** Nothing

---

## Problem

`frontend/src/features/chat/components/ContentWorkspace.tsx` invalidates the drafts query once when `streamingContentId` changes:

```typescript
useEffect(() => {
  if (streamingContentId) {
    void invalidateSessionDrafts(queryClient, sessionId);
  }
}, [streamingContentId, sessionId, queryClient]);
```

If that refetch lands before the new draft is visible to the read query, the sidebar stays stale until some later refresh happens.

---

## Key Correction

The earlier version of this plan relied on speculative SSE event shapes such as `tool-input-complete` and proposed building optimistic draft objects from tool input payloads. The current code does **not** expose that data path, and the fix does not need it.

We already have the only stable fact we need: the streamed `contentId`.

---

## Recommended Fix

Replace the one-shot invalidation with an `ensureDraftVisible` flow keyed by `streamingContentId`.

### Behavior

When a new `streamingContentId` appears:

1. refetch session drafts
2. check whether the returned list contains that id
3. if not, retry a few times with short backoff
4. stop once visible or after a small timeout window

This is simple, uses real server data, and avoids rendering guessed optimistic drafts.

---

## Implementation

### 1. Add a retry helper

Create a helper near the existing chat query invalidation utilities, for example:

```typescript
export async function ensureSessionDraftVisible(
  queryClient: QueryClient,
  sessionId: string,
  contentId: number,
  fetchDrafts: () => Promise<{ drafts: SessionDraft[] }>,
): Promise<void> {
  const delays = [0, 150, 300, 600, 1000];

  for (const delayMs of delays) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const data = await queryClient.fetchQuery({
      queryKey: queryKeys.api.sessionDrafts(sessionId),
      queryFn: fetchDrafts,
    });

    if (data.drafts.some((draft) => draft.id === contentId)) {
      return;
    }
  }
}
```

### 2. Use it from `ContentWorkspace.tsx`

Replace the current invalidation effect with:

```typescript
useEffect(() => {
  if (!streamingContentId) return;
  void ensureSessionDraftVisible(
    queryClient,
    sessionId,
    streamingContentId,
    () => fetcher(`/api/chat/sessions/${sessionId}/content`),
  );
}, [streamingContentId, sessionId, queryClient]);
```

### 3. Keep existing auto-activation

The separate effect that sets `onActiveContentChange(streamingContentId)` can stay as-is. This plan is about making the drafts list catch up reliably.

---

## Why This Direction

- uses the server as source of truth
- avoids undocumented SSE parsing assumptions
- avoids fake partial drafts in cache
- works whether the issue is transaction timing, async persistence, or query race

---

## Files Changed Summary

| File | Change |
|---|---|
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Replace one-shot invalidation with visibility retry flow |
| `frontend/src/shared/lib/query-invalidation.ts` or adjacent chat query helper | Add `ensureSessionDraftVisible(...)` |
