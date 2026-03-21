## Chat Streaming System

This document explains how chat streaming works conceptually — the mechanics, the data flow, and why it's designed the way it is.

---

## The Core Mechanic: Server-Sent Events (SSE)

When the user sends a chat message, the frontend opens a normal HTTP POST request to the backend. What makes it "streaming" is that the backend **never closes the connection immediately**. Instead, it keeps the connection open and drips data down it piece by piece as the AI generates tokens.

This is **one-directional**: the server pushes data to the client, not the other way around. It is **not** a WebSocket — the client can't send anything back over this connection once the request is sent. If the user wants to cancel, the client simply drops the connection (aborts the request).

The format over the wire is plain text, one event per line:

```
data: {"type":"text-delta","delta":"Hello"}

data: {"type":"text-delta","delta"," there"}

data: {"type":"tool-input-start","toolName":"save_content"}

data: {"type":"tool-output-available","output":{"contentId":42}}

data: [DONE]
```

Each line is a JSON object prefixed with `data: `. The client reads these lines one by one as they arrive, without waiting for the full response.

---

## What Actually Happens, Step by Step

### 1. User sends a message

The frontend makes a POST request with the message content. Before the response even comes back, it immediately renders the user's message in the UI (this is the "optimistic" message — it's fake, local-only, just to avoid the UI feeling laggy). It also sets up an empty box for the assistant's response that will fill in as tokens arrive.

### 2. Backend validates and persists the user message

Before touching the AI, the backend:
- Checks auth, rate limits, CSRF, and usage quotas
- Saves the user's message to the database

The user message is saved first so it's durable. If the AI call fails halfway through, the user's message is still there — nothing is lost.

### 3. Backend starts streaming from the AI

The backend calls the AI provider's API (also over a streaming HTTP connection — same concept, but between the backend and the AI provider). As the AI generates tokens, the backend receives them and immediately forwards them down to the frontend. The backend is a pass-through in this regard: it doesn't wait for the AI to finish before starting to respond to the client.

The connection chain looks like:

```
Frontend  ←──── SSE stream ────  Backend  ←──── AI provider stream ────  Claude/GPT/etc.
```

### 4. Frontend reads the stream

The frontend reads the response body byte by byte using the browser's streaming APIs. It accumulates bytes until it sees a newline, then parses that line as a JSON event. The two main events it cares about:

- **`text-delta`** — a new chunk of text from the AI. The frontend appends it to the message box in real time. This is what creates the "typing" effect.
- **`tool-input-start` / `tool-output-available`** — the AI is calling a tool (e.g. saving a draft). The UI shows a "Saving draft…" indicator and hides the tool-call XML that would otherwise appear as garbage in the chat.

### 5. AI finishes, backend wraps up

When the AI is done generating, the backend:
1. Saves the final assistant message to the database (with the full text)
2. Records token usage and cost
3. Closes the HTTP connection

### 6. Frontend reconciles

When the connection closes, the frontend:
1. Patches the local cache to include the real messages (replacing the optimistic fakes)
2. Fires a background refetch to pull the real DB-backed messages with their correct IDs and timestamps
3. The optimistic messages disappear and the real ones take their place — seamlessly, because the text is identical

---

## Why SSE Instead of Polling or WebSockets?

**vs. Polling**: If we polled (client repeatedly asks "is it done yet?"), there would be inherent latency between when the AI generates a token and when the user sees it. SSE pushes tokens immediately as they're available.

**vs. WebSockets**: WebSockets are bidirectional and require a persistent connection that lives across multiple messages. SSE is simpler — it's just a regular HTTP request that stays open. One request, one response stream, done. That fits the chat pattern well: each user message starts a new request.

---

## Tool Calls

The AI can decide mid-generation to call a tool (e.g. to save a content draft). When this happens:

1. The AI stops generating text and emits a tool call in its output
2. The backend intercepts this, executes the tool (writes to the database), and gets a result
3. The backend feeds the tool result back to the AI
4. The AI resumes generating text
5. All of this is transparent to the user — they see a "Saving draft…" indicator, then the AI's response continues

The frontend is notified via `tool-input-start` (tool started) and `tool-output-available` (tool finished, here's what it produced) events over the same SSE stream.

---

## Error Handling

**Usage limit hit**: The backend rejects the request immediately with a 403 before any streaming starts. No SSE connection is opened.

**AI provider error mid-stream**: The connection is already open and partially delivered. The backend catches the error and sends a final `{"type":"error","errorText":"..."}` event before closing the connection cleanly. The frontend renders an error message in the chat.

**User cancels**: The frontend aborts the HTTP request. The backend detects the disconnected client and stops streaming.

**Network drop**: The request fails like any other HTTP request. The frontend catches the error and shows an error state. The user message is already saved in the database, so nothing is lost — the user can retry.

---

## The Optimistic UI Pattern

The UI shows the user's message immediately (before the server confirms it) because database writes + network round trips would make the chat feel slow. This "optimistic message" is a fake local object with a temporary ID. Once the stream completes and the real server data is fetched, it's swapped in transparently.

The streaming assistant response works the same way: the text appearing letter-by-letter is local state being built up from `text-delta` events, not actual database content. Only when the stream ends does the assistant message get saved to the database and fetched back.

This means there's a brief window where the chat UI shows data that doesn't exist in the database yet — this is intentional and expected.
