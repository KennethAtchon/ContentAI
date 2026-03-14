# Bug: Chat Messages Inconsistent / No Text When Reel Attached

## Summary

Chat responses are unreliable. Sometimes the AI appears to "think" (tool loading state shows) but then no text is produced. This happens significantly more often when a reel is attached. The primary cause is a `stopWhen` limit on the AI that cuts off the response after 1 tool-call step — consuming the step on reel analysis, leaving no room for content generation. There are also secondary UI issues causing a brief flash of empty messages after any response.

---

## Root Cause 1 (Primary): `stopWhen: stepCountIs(1)` — AI tool step budget exhausted before content generation

**File:** `backend/src/routes/chat/index.ts:360`

```ts
const result = streamText({
  // ...
  stopWhen: stepCountIs(1),   // ← only 1 agentic step allowed
  tools: {
    save_content: tool({ ... }),
    get_reel_analysis: tool({ ... }),
    iterate_content: tool({ ... }),
  },
});
```

In AI SDK v6, a "step" is one complete inference → tool execution → cycle. `stepCountIs(1)` means: stop after 1 step has completed with tool calls.

### What happens WITHOUT a reel attached (usually works)

1. **Step 1**: AI streams text + calls `save_content` → tool executes → step completes
2. `stepCountIs(1)` triggers → stream ends
3. Result: text is streamed to user ✓, content is saved ✓

### What happens WITH a reel attached (always fails)

The system prompt instructs the AI to call `get_reel_analysis` before generating content:

> "Always call get_reel_analysis before generating content to understand the reel's patterns."

1. **Step 1**: AI calls `get_reel_analysis` (no text yet) → tool executes → step completes
2. `stepCountIs(1)` triggers → **stream ends here**
3. AI wanted Step 2 (generate text + call `save_content`) — **it's blocked**
4. Result: no text streamed ✗, no content saved ✗, empty assistant message written to DB ✗

This explains: "the AI tries to respond and then no text comes out" — the tool-call thinking animation shows (during `get_reel_analysis`), then nothing appears.

### Fix

Increase the step budget to 3 to allow: reel analysis → content generation → optional iteration:

```ts
// backend/src/routes/chat/index.ts
import { streamText, tool, stepCountIs } from "ai";

const result = streamText({
  // ...
  stopWhen: stepCountIs(3),   // ← was: stepCountIs(1)
  // ...
});
```

**Why 3?** The expected agentic flow with a reel is:
1. `get_reel_analysis` (optional, reel-only)
2. AI generates content text + calls `save_content` or `iterate_content`
3. (buffer for any unexpected extra step)

Without a reel, steps consumed = 1 (just `save_content`). With a reel, steps consumed = 2. Setting `stopWhen: stepCountIs(3)` safely handles both cases without risk of infinite loops.

---

## Root Cause 2 (Secondary): Flash of empty messages after stream ends

**File:** `frontend/src/features/chat/hooks/use-chat-stream.ts:138–151`

```ts
// After stream ends:
await queryClient.invalidateQueries({ queryKey: ["chat-sessions", sessionId] });
await queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });

// ...
} finally {
  setOptimisticUserMessage(null);   // ← clears user message
  setStreamingContent(null);         // ← clears AI response
  setIsStreaming(false);
  setIsSavingContent(false);
}
```

`invalidateQueries` marks queries stale and starts a background refetch, but its `await` resolves as soon as the queries are **marked stale** — it does NOT wait for the refetch to complete. The `finally` block then immediately clears the optimistic/streaming state.

**Sequence:**
1. Stream ends
2. `invalidateQueries` called → queries marked stale → background refetch starts
3. `finally` runs: optimistic message cleared, streaming content cleared
4. React re-renders: `displayMessages = sessionData?.messages ?? []` → **old data** (refetch not done yet)
5. ~100–500ms later: refetch completes → `sessionData` updates → messages appear

The user sees a brief flash where both their message and the AI response disappear. On slow connections this can be 1–2 seconds.

### Fix

Wait for the session refetch to complete before clearing the optimistic state. Use `invalidateQueries` + `refetchQueries`, or use `queryClient.fetchQuery` to ensure the data is loaded before clearing:

```ts
// After stream ends, in use-chat-stream.ts
// Invalidate and WAIT for the specific session to finish refetching
await queryClient.invalidateQueries({
  queryKey: ["chat-sessions", sessionId],
  refetchType: "active",
});
// Wait for the refetch to finish so there's no flash when we clear optimistic state
await queryClient.refetchQueries({ queryKey: ["chat-sessions", sessionId] });

// Now clear optimistic state — the real data is already in cache
} finally {
  setOptimisticUserMessage(null);
  setStreamingContent(null);
  setIsStreaming(false);
  setIsSavingContent(false);
}
```

Note: `refetchQueries` actually waits for the fetch to complete. Alternatively, clear the optimistic state INSIDE the try block right before the invalidation:

```ts
// More aggressive approach: clear streaming content first, THEN invalidate
setStreamingContent(null);       // stop showing streaming placeholder
setOptimisticUserMessage(null);  // the real message will appear momentarily

await queryClient.invalidateQueries({ queryKey: ["chat-sessions", sessionId] });
await queryClient.refetchQueries({ queryKey: ["chat-sessions", sessionId] });

// finally only handles error states
} finally {
  setIsStreaming(false);
  setIsSavingContent(false);
}
```

---

## Root Cause 3 (Secondary): Reel attachment state uses stale session data during streaming

**File:** `frontend/src/features/chat/components/ChatLayout.tsx:74–128`

```ts
// Derived from persisted sessionData — NOT from the optimistic message
const lastReelRefs = useMemo(() => {
  if (!sessionData) return [];
  const userMessages = sessionData.messages.filter((m) => m.role === "user");
  const lastMessage = userMessages[userMessages.length - 1];
  return lastMessage?.reelRefs || [];
}, [sessionData]);

// This effect depends on sessionData and fires again on every cache update
useEffect(() => {
  void loadReels();   // fetches /api/reels/bulk
}, [lastReelRefs, search.reelId, sessionData]);  // ← sessionData here causes re-fires
```

When a user attaches a reel and sends a message:
1. Optimistic message is added (has `reelRefs: [123]`)
2. `sessionData` hasn't updated yet — `lastReelRefs` still shows the previous message's reels
3. The `activeReelRefs` displayed in `ChatInput` shows wrong/stale reels during the entire streaming window (5–30 seconds)
4. After stream ends + cache refetch, `sessionData` updates and the correct reels finally show

Additionally, `sessionData` is in the effect dependency array (line 128). This means the reel-loading effect fires on every `sessionData` change — including the invalidation that happens after every message send. This causes the reel cards to flicker briefly after each message.

### Fix

1. **Track reel state locally** in addition to deriving from session:

```ts
// In ChatLayout.tsx
const [pendingReelRefs, setPendingReelRefs] = useState<number[]>([]);

const handleSendMessage = async (content: string, reelRefs?: number[]) => {
  if (reelRefs?.length) setPendingReelRefs(reelRefs);   // capture before send
  await sendMessage(content, reelRefs);
};

// Use pendingReelRefs as the source of truth DURING streaming
const lastReelRefs = useMemo(() => {
  if (isStreaming && pendingReelRefs.length > 0) return pendingReelRefs;
  if (!sessionData) return [];
  const userMessages = sessionData.messages.filter((m) => m.role === "user");
  const lastMessage = userMessages[userMessages.length - 1];
  return lastMessage?.reelRefs || [];
}, [sessionData, isStreaming, pendingReelRefs]);
```

2. **Remove `sessionData` from the reel-loading effect dependency array** to prevent re-fires on every cache update:

```ts
useEffect(() => {
  void loadReels();
}, [lastReelRefs, search.reelId]);   // ← removed sessionData
```

The reel data only needs to reload when `lastReelRefs` actually changes, not whenever `sessionData` is refreshed.

---

## Root Cause 4 (Secondary): `get_reel_analysis` returning empty result silently stops generation

**File:** `backend/src/routes/chat/index.ts:468`

```ts
if (!analysis) {
  return { error: "no_analysis_found" };
}
```

If a reel has no analysis data in the DB (the analysis hasn't been computed yet), the tool returns `{error: "no_analysis_found"}`. The AI receives this error result and — depending on the model — may either:
- Attempt to continue and generate content without the deep analysis (good)
- Halt or produce an unhelpful response (bad)

This is an AI behavior issue, but it can be mitigated by making the error message more instructive:

```ts
if (!analysis) {
  return {
    error: "no_analysis_found",
    message: "No deep analysis available for this reel. Proceed to generate content using only the basic reel info provided in the context (username, hook, view count)."
  };
}
```

---

## Complete Fix Checklist

1. **[Critical]** Change `stopWhen: stepCountIs(1)` → `stopWhen: stepCountIs(3)` in `backend/src/routes/chat/index.ts:360`
2. **[High]** Fix the flash: await `refetchQueries` before clearing optimistic state in `frontend/src/features/chat/hooks/use-chat-stream.ts`
3. **[Medium]** Fix stale reel state: track pending reel refs locally during streaming in `frontend/src/features/chat/components/ChatLayout.tsx`
4. **[Low]** Remove `sessionData` from the reel-loading effect dependency array
5. **[Low]** Improve `no_analysis_found` error message to guide the AI to continue

---

## Verification

1. Open a chat session, attach a reel, and send a message.
2. Confirm that text appears in the streaming window (not just the thinking animation).
3. Confirm that after the stream ends, the messages do not flash/disappear before the final render.
4. Confirm that the reel attachment badge in the input area shows correctly during streaming.
5. Test without a reel attached — confirm behavior is unchanged.
6. Test iteration requests (`iterate_content`) — confirm they still work.
