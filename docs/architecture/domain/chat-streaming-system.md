## Chat Streaming System

This document describes, in detail, how our **chat streaming** works end‑to‑end across the frontend, API layer, AI SDK, and persistence/usage tracking. It focuses on the `/api/chat/sessions/:id/messages` endpoint and the `useChatStream` hook used by the Studio chat UI.

---

## High‑Level Overview

- **Trigger**: User submits a message from the Studio chat input.
- **Frontend**:
  - Immediately shows an **optimistic user message**.
  - Opens a **long‑lived HTTP POST** to `/api/chat/sessions/:id/messages`.
  - Consumes a **Server‑Sent Events (SSE)** style stream of JSON `data:` lines.
  - Builds up the visible assistant message from `text-delta` events.
- **Backend route** (`backend/src/routes/chat/index.ts`):
  - Validates **auth**, **rate limits**, **CSRF**, and **usage limits**.
  - Persists the **user message** to the database.
  - Builds **prompt context** (project, reels, active draft).
  - Calls the `ai` SDK’s `streamText` with **tools** (e.g. `save_content`, `iterate_content`).
  - Wraps the AI stream in a **safe ReadableStream** and returns it via `createUIMessageStreamResponse`.
  - On finish:
    - Saves the **assistant message**.
    - Records **usage** and **AI cost**.
    - Updates the **session timestamp**.
- **AI client** (`backend/src/lib/aiClient.ts`):
  - Resolves the **model instance** with provider‑specific handling.
  - Exposes `getModel`/`getModelInfo` so routes can use `streamText` consistently.

---

## Frontend Streaming Flow

### 1. Entry Point: `ChatLayout` and `useChatStream`

- `ChatLayout` wires the chat UI:
  - Reads `sessionId` from the router search params.
  - Uses `useChatSession(sessionId)` to fetch server messages.
  - Uses `useChatStream(sessionId)` to **send messages and consume the stream**.
  - Merges:
    - **Server messages** from TanStack Query.
    - **Optimistic user message**.
    - **Streaming assistant overlay** (current partial text).
  - Passes the merged list to `ChatPanel` as `messages`.

- `handleSendMessage` in `ChatLayout`:
  - Stores `pendingReelIds` so the UI knows which reels are attached while the session data has not yet refreshed.
  - Calls:
    - `await sendMessage(content, reelRefs, activeContentId ?? undefined);`
  - Clears `pendingReelIds` afterwards.

### 2. `useChatStream` Hook

File: `frontend/src/features/chat/hooks/use-chat-stream.ts`

**Key state:**

- `optimisticUserMessage`: user message shown immediately before server persistence is visible.
- `streamingContent`: current **partial assistant text** being streamed.
- `isStreaming`: whether a stream is active.
- `streamError`: human‑readable error text if something goes wrong mid‑stream.
- `isLimitReached`: usage‑limit flag driven by a 403 from the backend.
- `isSavingContent`: whether a `save_content`/`iterate_content` tool appears to be running.
- `streamingContentId`: ID of generated content saved by tools (e.g. a new draft).
- `streamingMessageId`: stable ID for the **overlay assistant message** while streaming.
- `abortRef`: `AbortController` used to cancel an in‑flight stream.

#### 2.1 Starting a Stream (`sendMessage`)

When `sendMessage(content, reelRefs, activeContentId)` is called:

1. **Guard rails**:
   - If there is no `sessionId` or `isStreaming` is true, it returns early (prevents overlapping streams).

2. **Abort existing stream**:
   - `abortRef.current?.abort();`
   - Creates a new `AbortController` for this request.

3. **Pin a streaming message ID**:
   - `streamingIdRef.current = "streaming-${sessionId}-${Date.now()}"`.
   - This ID is used as the `id` for the overlay assistant message to keep React keys stable for the entire response.

4. **Create optimistic user message**:
   - Builds a `ChatMessage` object with a temporary ID and `role: "user"`.
   - Sets:
     - `setOptimisticUserMessage(optimisticMsg);`
     - `setStreamingContent("");`
     - `setIsStreaming(true);`
     - Clears previous error/flags.

5. **Issue HTTP POST**:
   - Uses `authenticatedFetch`:
     - URL: `/api/chat/sessions/${sessionId}/messages`
     - Method: `POST`
     - JSON body: `{ content, reelRefs, activeContentId }`
     - Timeout: **120 seconds** (tailored for long streams).
     - `signal: controller.signal` for cancellation.

6. **Handle 403 / usage limit**:
   - If status is `403`, it tries to parse `{ code }` from JSON body.
   - If `code === "USAGE_LIMIT_REACHED"`:
     - Sets `isLimitReached = true`.
     - Clears optimistic and streaming state.
     - Invalidates `reelsUsage` and `usageStats` queries so the UI updates limits display.
     - Returns early without starting SSE parsing.

7. **Validate response**:
   - If `!response.ok`, throws `Error("HTTP <status>")`.
   - If `!response.body`, throws `"No response body"` (required for streaming).

#### 2.2 Consuming the SSE Stream

Once the response has a body:

1. **Create a reader and buffers**:
   - `const reader = response.body.getReader();`
   - `const decoder = new TextDecoder();`
   - String buffers for **partial lines** and **accumulated assistant text**.

2. **Streaming loop**:
   - In a `while (true)` loop:
     - Reads chunks from the reader.
     - Decodes them as text.
     - Splits by newline.
     - Processes **complete lines**; keeps the final incomplete line in `buffer`.

3. **`processLine` and JSON events**:
   - Ignores lines that do not start with `data: `.
   - Strips the prefix and inspects the content:
     - If equal to `[DONE]`, logs and returns.
     - Otherwise parses JSON:
       - `{ type: string, ... }`.

4. **Event types handled on the frontend**:

   - **`text-delta`**:
     - Appends `chunk.delta` to `accumulated`.
     - Runs `filterToolCallXml(accumulated)` to:
       - Strip `<tool_call>...</tool_call>` blocks.
       - Also drop partially streamed `<tool_call>` at the tail.
     - Updates `streamingContent` with the filtered text.
     - If `accumulated` includes `<tool_call>` plus `save_content`/`iterate_content`:
       - Sets `isSavingContent = true` to show “saving draft” type indicators.

   - **`tool-input-start`**:
     - Logs `toolName`.
     - If the tool is `save_content` or `iterate_content`, sets `isSavingContent = true`.

   - **`tool-output-available`**:
     - Expects `chunk.output` with `{ contentId?: number; success?: boolean }`.
     - If `contentId` exists:
       - Calls `setStreamingContentId(contentId)`.
       - This is used by `ChatLayout` to auto‑open the workspace/preview on first draft.
     - Always sets `isSavingContent = false` after the tool output resolves.

   - **`error`**:
     - Expects `errorText` in the chunk.
     - Logs and sets `streamError` for user‑visible feedback.

   - Any other `type` is logged at debug level and ignored by the UI.

5. **End of stream**:
   - After the reader returns `done: true`, the hook:
     - Calls `processLine(buffer)` if any residual text remains.
     - Logs final counts (chunks, deltas, length).

#### 2.3 Syncing With Query Cache

Once streaming completes normally:

- `queryClient.setQueryData(["chat-sessions", sessionId], updater)`
  - Injects:
    - The **optimistic user message**, if it hasn't already been replaced by the server’s version.
    - A **temporary assistant message** with the fully accumulated text.
  - Uses a **different temporary assistant ID** (`ai-pending-...`) than the streaming overlay ID to avoid React key collisions during synchronous updates.

- Clears local overlay state:
  - `setOptimisticUserMessage(null);`
  - `setStreamingContent(null);`

- Kicks off a background refetch:
  - `invalidateQueries({ queryKey: ["chat-sessions", sessionId] })`.
  - Replaces optimistic/temporary messages with **real DB‑backed messages** (correct IDs, linked content, timestamps).

#### 2.4 Error and Abort Handling

- **Abort**:
  - If the `AbortController` is triggered, the stream loop sees an `AbortError`:
    - Logs a benign “Stream aborted by user”.
    - Clears optimistic and streaming state.

- **Other errors**:
  - Logs error name/message.
  - Sets `streamError` with the error message (for inline UI display).
  - Always clears `optimisticUserMessage` and `streamingContent` in `finally`.
  - Resets `isStreaming` and `isSavingContent` to `false`.

---

## Backend Streaming Flow

### 1. Route Definition and Middleware

File: `backend/src/routes/chat/index.ts`

Endpoint: `POST /api/chat/sessions/:id/messages`

- Wrapped with:
  - `rateLimiter("customer")` → request rate protection.
  - `csrfMiddleware()` → CSRF protection for unsafe methods.
  - `authMiddleware("user")` → user authentication.
  - `usageGate("generation")` → checks **usage limits** before starting AI.
  - `zValidator("json", sendMessageSchema)` → payload validation:
    - `content: string` (1–4000 chars)
    - `reelRefs?: number[]`
    - `activeContentId?: number`

If any middleware fails, the request is short‑circuited (e.g. 403 for usage limit).

### 2. Session Verification and History Loading

Inside the handler:

1. **Auth/context**:
   - `const auth = c.get("auth");`
   - Reads `sessionId` from `c.req.param("id")`.

2. **Session lookup**:
   - Ensures the chat session exists and belongs to the current user.
   - Joins `projects` to also fetch project metadata.
   - If not found:
     - Logs a warning.
     - Returns `404 { error: "Session not found" }`.

3. **Conversation history**:
   - Fetches the **last 20 messages** for this session, ordered oldest→newest.
   - Only stores `{ role, content }` (no reel refs) for AI context.

### 3. Persisting the User Message

- Before calling the AI:
  - Generates a `userMessageId` (UUID).
  - Inserts a `chatMessages` row:
    - `role: "user"`.
    - `content` from the request.
    - `reelRefs` stored as array if present.
- This guarantees:
  - The user message is durable even if the AI stream later fails.

### 4. Auto‑Titling the Session

- If the session title is the placeholder `"New Chat Session"`:
  - Creates an `autoTitle` from the first 50 characters of `content` (with `...` suffix if longer).
  - Updates the `chatSessions` title in the DB.

### 5. Prompt Context Construction

**`buildChatContext(userId, project, reelRefs, activeContentId)`**:

- Base string: `"Project: <project.name>"`.
- If `reelRefs` provided:
  - Loads reel rows (id, username, views, niche, hook).
  - Appends human‑readable lines summarizing each reel, including a hint to the AI:
    - “use `get_reel_analysis` to fetch deep analysis before generating”.
- If `activeContentId` provided:
  - Verifies that the referenced `generatedContent` row belongs to the user.
  - Appends an “Active Draft” section:
    - Includes ID, version, truncated script, hook, and type.
    - Instructs the AI:
      - “When the user asks to edit/refine this, call `iterate_content` with `parentContentId` equal to this ID.”

**System prompt**:

- `getChatSystemPrompt()` returns:
  - `loadPrompt("chat-generate")` from `backend/src/prompts/chat-generate.txt` if present.
  - Otherwise falls back to a generic content‑creation system prompt.

**User prompt**:

- If context present:
  - `"Context:\n${context}\n\nUser message: ${content}"`
- Otherwise:
  - Just the raw `content`.

### 6. Model Selection

The route uses helper functions from `backend/src/lib/aiClient.ts`:

- `getModel("generation")`:
  - Reads our **provider/model configuration**.
  - Returns an instance compatible with `ai`’s `streamText`:
    - For non‑Claude providers that expose `chat`, uses `instance.chat(model)` to align with Chat Completions API.
    - Otherwise calls the base instance (`instance(model)`).

- `getModelInfo("generation")`:
  - Returns `{ provider, model }` for logging and cost tracking.

We also capture `streamStartMs = Date.now()` for latency metrics.

### 7. Tool Context and `streamText` Call

Before invoking the AI:

- A closure variable `savedContentId: number | null` is declared.
- A `ToolContext` is constructed:
  - `{ auth, content, reelRefs, get savedContentId, set savedContentId }`.
  - Passed into `createChatTools(toolContext)` which defines tools such as:
    - `save_content`
    - `iterate_content`
  - These tools **mutate `savedContentId`** when they persist or update drafts.

`streamText` is then called with:

- `model`: `getModel("generation")`.
- `system`: system prompt (chat‑generate or fallback).
- `messages`:
  - Previous 20 messages, cast to `"user" | "assistant"` roles.
  - Final entry: `{ role: "user", content: userPrompt }`.
- `maxOutputTokens`: 2048.
- `toolChoice: "auto"` so the model is free to decide when to call tools.
- `stopWhen: stepCountIs(5)` to cap the number of tool/call iterations (prevents infinite loops).
- `tools`: created via `createChatTools(toolContext)`.

#### 7.1 Error Handling (`onError`)

- `onError` is invoked if the AI provider emits a stream‑level error.
- It:
  - Logs details (session, error message).
  - Does **not** send anything to the client directly; instead, the outer `ReadableStream` layer handles converting failures into a client‑visible `error` event.

#### 7.2 Completion Handling (`onFinish`)

When the AI finishes producing text:

- Receives:
  - `rawText`: full AI text including any tool‑call XML that slipped through.
  - `totalUsage`: provider‑specific usage object.

Steps:

1. **Sanitize text**:
   - Strips `<tool_call>...</tool_call>` XML blocks from `rawText` (server‑side cleanup).
   - Trims trailing whitespace → final `text` stored in DB.

2. **Calculate metrics**:
   - `durationMs = Date.now() - streamStartMs`.
   - `inputTokens` / `outputTokens` extracted via `extractUsageTokens`.

3. **Record usage (logical feature usage)**:
   - Calls `recordUsage` with:
     - `userId`, feature type `"generation"`, and metadata:
       - `{ sessionId, promptLength: content.length }`
       - `{ textLength: text.length }`
   - Any failure here is ignored (logged but does not break chat flow).

4. **Persist assistant message**:
   - Generates `assistantMessageId`.
   - Inserts `chatMessages` row with:
     - `role: "assistant"`.
     - `content: text` (sanitized).
     - `generatedContentId: savedContentId` (if tools saved a draft).
     - `reelRefs` same as user message for symmetry.

5. **Update session timestamp**:
   - Sets `chatSessions.updatedAt = new Date()`.

6. **Record AI cost (monetary usage)**:
   - Calls `recordAiCost` with:
     - `userId`, `provider`, `model`, `featureType: "generation"`.
     - Token counts and duration.
   - Failures are caught and ignored (logging only).

If any part of this persistence flow throws, errors are logged but do **not** retroactively break the already‑delivered stream.

---

## Streaming Response to Client

### 1. Base `ai` SDK UI Stream

`streamText` returns an object (`result`) that can be transformed into a **UI message stream**:

- `result.toUIMessageStream()`:
  - Provides a stream of events already shaped for frontends.
  - Supports events like:
    - `text-delta`
    - `tool-input-start`
    - `tool-output-available`
    - `error`

Each event is encoded as an SSE `data:` line by our wrapper.

### 2. Safe Wrapper `ReadableStream`

To prevent **ERR_INCOMPLETE_CHUNKED_ENCODING** and to surface errors cleanly:

- The route constructs:

  - A new `ReadableStream` (`safeStream`).
  - Inside `start(controller)`:
    - Obtains a reader from `result.toUIMessageStream()`.
    - Reads events in a loop, enqueuing them into `controller`.
    - On normal completion:
      - Calls `controller.close()`.
    - On error:
      - Logs the error (`[chat:stream] Stream terminated with error`).
      - Attempts to enqueue a final event:
        - `{ type: "error", errorText: "..." }`.
      - Closes the controller, swallowing any double‑close issues.

This means that even if the underlying provider fails mid‑stream:

- The HTTP connection still ends gracefully.
- The frontend sees a **structured `error` SSE event**.

### 3. `createUIMessageStreamResponse`

Finally, the route returns:

- `return createUIMessageStreamResponse({ stream: safeStream });`

This helper from the `ai` SDK:

- Sets the correct **content type** and headers for SSE.
- Serializes each event from `safeStream` as:
  - `data: <JSON>\n\n`
  - Optional `[DONE]` marker at the end depending on configuration.
- Keeps the connection open until the stream ends or errors.

On the frontend side, this is consumed with:

- `response.body.getReader()` + `TextDecoder` and the `processLine` logic described earlier.

---

## Usage Limits, Errors, and UX Signals

### Usage Limits

- Enforced by `usageGate("generation")` on the route.
- When limits are exceeded:
  - Route returns `403` with a `{ code: "USAGE_LIMIT_REACHED" }` body.
  - `useChatStream` sets `isLimitReached = true`.
  - Related usage queries are invalidated so the Studio UI can display up‑to‑date quotas.
  - No streaming is started in this case.

### Stream‑Level Errors

- Provider or network errors in the AI stream:
  - Logged by the backend (`onError` and the safe wrapper).
  - Converted into a **final SSE event** with `type: "error"` and `errorText`.
  - Parsed by `useChatStream` and surfaced via `streamError`.

### Tool‑Related UX

- When `save_content` or `iterate_content` begins (tool input):
  - `isSavingContent` becomes `true`.
  - The UI can show a “Saving draft…” indicator.

- When tool output is available:
  - `streamingContentId` is set if the tool returned a `contentId`.
  - `ChatLayout` auto‑opens the workspace the first time this happens in a session.

---

## Summary

- Streaming is implemented as a **typed SSE channel** between backend and frontend, powered by the `ai` SDK’s `streamText` and `createUIMessageStreamResponse`.
- The **frontend** maintains an optimistic UI, parses SSE `data:` JSON events, and merges streamed text into the chat timeline while gracefully handling limits and errors.
- The **backend** handles authentication, rate/usage gating, prompt construction, tool execution, and persistence, while wrapping the AI stream to guarantee graceful completion.
- Tool events (`save_content`, `iterate_content`) are surfaced through the same stream to provide rich, real‑time UX around draft creation and iteration.

