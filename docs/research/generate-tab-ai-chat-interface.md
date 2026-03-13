# Generate Tab Reimagination: AI Chat Interface

Research and implementation plan for replacing the current Generate tab with a conversational AI chat interface featuring projects, user niches, and reel referencing.

**Date:** 2026-03-12
**Status:** Planning
**Related:** `frontend/src/routes/studio/generate.tsx`, `backend/src/services/reels/content-generator.ts`, `backend/src/lib/aiClient.ts`

---

## Current State

The Generate tab (`/studio/generate`) is a single-turn form:
- Left panel: reel list filtered by a hardcoded `"personal finance"` niche
- Center: textarea + output type pills (full/hook/caption) + generate button
- Right: history sidebar showing `generatedContent` rows
- Backend: `POST /api/generation` calls `generateText()` via Vercel AI SDK (OpenAI primary, Claude fallback)

**What's missing:**
- No project concept (user-owned workspaces)
- No user niche preferences (only admin-managed system niches exist)
- No conversation history / multi-turn context
- No streaming responses
- No way to reference multiple reels in a single interaction
- Niche is hardcoded to `"personal finance"`

---

## Design Decisions

### User Niches vs System Niches

| Aspect | System Niches (existing) | User Niches (new) |
|--------|-------------------------|-------------------|
| Created by | Admins | Users |
| Purpose | Catalog reels for discovery | Categorize user projects |
| Stored in | `niches` table | `userNiches` join table |
| Uniqueness | System-wide | Per-user |
| Format | Free text (admin-entered) | Free text (user-entered) |

User niches are stored in the existing `niches` table (reusing the same entity) but linked to users via a `userNiches` join table. This avoids duplicating niche names and lets users discover/pick from existing niches or create new ones. A user niche on a project is optional — it serves as a categorization label, not a filter.

### Reel Referencing: Hybrid Approach

Users can reference reels in chat messages via two mechanisms:

1. **Picker modal** — "Attach Reel" button opens a searchable modal with niche filter, showing reel cards. Selected reels appear as chips above the message input. This is the primary path for browsing.

2. **`@` mention with scoped search** — typing `@` in the message input triggers a debounced fuzzy search (`GET /api/reels/search?q=...&limit=10`). The search queries `hook ILIKE` + `username ILIKE` with a combined `LIMIT 10`. At 100k reels this is fast — it's a single indexed query with a small result set, not a client-side filter.

**Why not just `@`?** The picker modal gives users a visual way to browse when they don't know what they're looking for. The `@` mention is for power users who remember a specific reel's hook or creator.

**Context injection:** When a reel is referenced, the backend fetches the reel + its analysis (hook, caption, engagement stats, hookPattern, emotionalTrigger, remixSuggestion) and injects it into the AI system prompt. Max 5 reels per message to bound context size.

### Streaming Architecture

The Vercel AI SDK is already in use (`backend/src/lib/aiClient.ts`). For chat:
- Backend: `streamText()` + `toDataStreamResponse()` (returns a standard `Response` Hono can serve directly)
- Frontend: `useChat` from `ai/react` with custom `fetch` (passes Firebase auth token + CSRF via `authenticatedFetch`)

This avoids building a custom SSE layer. The `useChat` hook manages message state, loading indicators, and stream concatenation automatically.

---

## Data Model

### New Tables

```sql
-- User projects (workspaces for content generation)
projects
  id            serial PK
  userId        text NOT NULL           -- references users.id
  name          text NOT NULL
  description   text
  nicheId       integer                 -- optional, references niches.id
  createdAt     timestamp DEFAULT now()
  updatedAt     timestamp DEFAULT now()

-- User niche preferences (which niches a user works with)
userNiches
  id            serial PK
  userId        text NOT NULL
  nicheId       integer NOT NULL        -- references niches.id
  isPrimary     boolean DEFAULT false
  createdAt     timestamp DEFAULT now()
  UNIQUE(userId, nicheId)

-- Chat sessions (conversation threads within a project)
chatSessions
  id            serial PK
  userId        text NOT NULL
  projectId     integer                 -- nullable (uncategorized sessions allowed)
  title         text                    -- auto-generated from first message
  createdAt     timestamp DEFAULT now()
  updatedAt     timestamp DEFAULT now()

-- Chat messages (individual messages within a session)
chatMessages
  id                   serial PK
  sessionId            integer NOT NULL  -- references chatSessions.id, CASCADE delete
  role                 text NOT NULL     -- "user" | "assistant"
  content              text NOT NULL
  reelRefs             jsonb             -- array of reel IDs referenced in this message
  generatedContentId   integer           -- FK to generatedContent (when assistant saves output)
  createdAt            timestamp DEFAULT now()
```

### Indexes

```
projects_user_id_idx           ON projects(userId)
user_niches_user_id_idx        ON userNiches(userId)
chat_sessions_user_id_idx      ON chatSessions(userId)
chat_sessions_project_id_idx   ON chatSessions(projectId)
chat_messages_session_id_idx   ON chatMessages(sessionId)
```

### Entity Relationships

```
users  1──M  projects      (a user owns many projects)
users  1──M  userNiches    (a user selects many niches)
niches 1──M  userNiches    (a niche is selected by many users)
niches 1──M  projects      (a project optionally has one niche)
projects 1──M chatSessions (a project contains many sessions)
users  1──M  chatSessions  (a user owns many sessions)
chatSessions 1──M chatMessages (a session contains many messages)
chatMessages M──1 generatedContent (an assistant message may save to generatedContent)
chatMessages M──M reels     (a message may reference multiple reels via reelRefs jsonb)
```

---

## API Design

### Projects

```
GET    /api/projects              — list user's projects
POST   /api/projects              — create { name, description?, nicheId? }
GET    /api/projects/:id          — single project with session count
PUT    /api/projects/:id          — update name/description/nicheId
DELETE /api/projects/:id          — delete project + cascade sessions
```

### User Niches

```
GET    /api/user-niches           — list user's niche selections
POST   /api/user-niches           — add { nicheId, isPrimary? }
DELETE /api/user-niches/:nicheId  — remove niche selection
PATCH  /api/user-niches/:nicheId  — set as primary
```

### Chat

```
GET    /api/chat/sessions                     — list sessions (filter: ?projectId=)
POST   /api/chat/sessions                     — create { projectId?, title? }
GET    /api/chat/sessions/:id                 — session + all messages
DELETE /api/chat/sessions/:id                 — delete session + messages

POST   /api/chat/sessions/:id/messages        — send message + stream AI response
  Body: { content: string, reelRefs?: number[] }
  Response: SSE stream (Vercel AI SDK data stream protocol)
```

### Reel Search (new endpoint for `@` mentions)

```
GET    /api/reels/search?q=...&limit=10       — fuzzy search by hook text or username
```

All endpoints use the standard middleware stack: `rateLimiter("customer")` + `csrfMiddleware()` on mutations + `authMiddleware("user")`.

---

## Frontend Architecture

### UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  StudioTopBar  [Discover]  [Generate*]  [Queue]          │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  Project     │  Chat Thread                              │
│  Sidebar     │                                           │
│              │  ┌─────────────────────────────────────┐  │
│  [+ New]     │  │  user: Generate a hook about...     │  │
│              │  │  [📎 Reel: @fitness_guru #1234]     │  │
│  Projects:   │  │                                     │  │
│  > My Brand  │  │  assistant: Here's a hook...        │  │
│    Fitness   │  │  ┌──────────────────────────────┐   │  │
│    Tech      │  │  │ Generated Hook               │   │  │
│              │  │  │ "Stop scrolling if you..."    │   │  │
│  Sessions:   │  │  └──────────────────────────────┘   │  │
│  - Hook ideas│  │                                     │  │
│  - Remix v2  │  └─────────────────────────────────────┘  │
│  - Captions  │                                           │
│              │  ┌─────────────────────────────────────┐  │
│  Niches:     │  │ [📎 Attach] [Type message...]  [➤] │  │
│  [Fitness]   │  │ Attached: Reel #1234, Reel #5678   │  │
│  [+ Add]     │  └─────────────────────────────────────┘  │
└──────────────┴───────────────────────────────────────────┘
```

- **Left sidebar (260px):** Project list, session list for active project, user niche chips
- **Center (flex-1):** Chat message thread + input bar with reel attachment
- **No right panel** — the chat interface uses full width for the conversation

### Feature Folder Structure

```
src/features/chat/
├── components/
│   ├── ChatPanel.tsx            — main chat thread + input
│   ├── ChatMessage.tsx          — single message bubble
│   ├── ChatInput.tsx            — message input with @ mention + attach button
│   ├── ReelReferenceChip.tsx    — compact reel chip in messages
│   ├── ReelPickerModal.tsx      — modal to browse/search reels
│   ├── ProjectSidebar.tsx       — left panel
│   ├── ProjectForm.tsx          — create/edit project dialog
│   ├── SessionList.tsx          — session list within a project
│   └── GeneratedContentBlock.tsx — styled output block in assistant messages
├── hooks/
│   ├── use-projects.ts          — project CRUD queries/mutations
│   ├── use-user-niches.ts       — user niche CRUD
│   ├── use-chat-sessions.ts     — session CRUD + message fetching
│   └── use-chat-stream.ts       — useChat wrapper with auth
├── services/
│   └── chat.ts                  — API call helpers
└── types/
    └── chat.types.ts            — Project, ChatSession, ChatMessage types
```

### Query Keys

```typescript
// Added to src/shared/lib/query-keys.ts
projects: () => ["api", "projects"],
project: (id: number) => ["api", "project", id],
userNiches: () => ["api", "user-niches"],
chatSessions: (projectId?: number) => ["api", "chat-sessions", projectId],
chatSession: (id: number) => ["api", "chat-session", id],
chatMessages: (sessionId: number) => ["api", "chat-messages", sessionId],
reelSearch: (query: string) => ["api", "reel-search", query],
```

### Route State

The generate route stores `projectId` and `sessionId` in URL search params:

```
/studio/generate?project=1&session=5
```

This makes sessions bookmarkable and supports browser back/forward. TanStack Router `validateSearch` handles parsing.

---

## Streaming Flow

```
User types message + attaches reels
  → Frontend: useChat sends POST /api/chat/sessions/:id/messages
    → Backend: validate session ownership
    → Backend: save user message to chatMessages
    → Backend: auto-title session if first message
    → Backend: fetch referenced reels + analyses
    → Backend: build system prompt (niche context + reel data)
    → Backend: streamText() with Vercel AI SDK
    → Backend: pipe stream via toDataStreamResponse()
  → Frontend: useChat accumulates streamed tokens into assistant message
  → Stream completes:
    → Backend: parse full response, save to generatedContent + chatMessages
    → Frontend: useChat marks message as complete
```

### Interrupted Stream Recovery

If a stream is interrupted (client disconnect, server error), the last message in the session will be a `role: "user"` with no following `role: "assistant"`. On session load, detect this and show: "Generation was interrupted — click to retry."

---

## AI Prompt Design

### System Prompt Template (`chat-generate.txt`)

```
You are a creative content strategist and reel scriptwriter.

Project context:
- Niche: {nicheName || "General"}
- User's goal: Help create engaging short-form video content (reels, TikToks, shorts)

{#if reelRefs}
Referenced reels for context:
{#each reelRef}
---
Reel #{reelId} by @{username}
Hook: "{hook}"
Caption: "{caption}"
Views: {views} | Likes: {likes} | Comments: {comments}
Hook Pattern: {hookPattern}
Emotional Trigger: {emotionalTrigger}
Remix Suggestion: {remixSuggestion}
---
{/each}
{/if}

Instructions:
- When generating hooks, captions, or scripts, format your output clearly with labeled sections
- Support iterative refinement ("make it shorter", "change the angle", "more emotional")
- When referencing attached reels, explain what makes them work and how you're adapting their patterns
- Keep hooks under 10 words when possible
- Match the energy and style of the user's niche
- Be conversational and collaborative, not formal
```

### Model Selection

- **Chat responses:** OpenAI GPT-4o-mini or similar cheap model (fast, good at creative writing)
- **Image generation:** Placeholder for proof of concept — can integrate later
- **Fallback:** Claude Haiku (already configured as fallback in `aiClient.ts`)

---

## Risks and Edge Cases

### R1: Streaming + Hono Compatibility
Hono >= 4 supports returning raw `Response` objects. The Vercel AI SDK's `toDataStreamResponse()` returns a `Response`. Verify Hono version in `backend/package.json` — if < 4, upgrade.

### R2: CSRF on Streaming Endpoint
The `authenticatedFetch` wrapper on the frontend handles CSRF token injection for all requests including streaming POSTs. The `useChat` hook accepts a custom `fetch` — pass `authenticatedFetch` through it.

### R3: Context Window Limits
Each referenced reel adds ~200-500 tokens to the system prompt. With 5 reels max + conversation history, a single request could reach 4-8k tokens of context. GPT-4o-mini handles 128k context — this is well within bounds. Cap conversation history at last 50 messages to be safe.

### R4: Session Title Auto-Generation
On first message, set `chatSessions.title` to the first 50 characters of the user message content. Users can rename later via `PUT /api/chat/sessions/:id`.

### R5: Project-less Sessions
Allow `projectId: null` on `chatSessions`. These appear in the sidebar under an "Uncategorized" group. Users can move them to a project later.

### R6: Reel Search Performance at Scale
The `@` mention search queries `WHERE hook ILIKE '%query%' OR username ILIKE '%query%' LIMIT 10`. At 100k reels, `ILIKE` with a leading wildcard cannot use a B-tree index. Options:
- **Acceptable for MVP:** 100k rows with `ILIKE` and `LIMIT 10` typically returns in <50ms on Postgres — fast enough for a debounced (300ms) typeahead
- **At scale (1M+ reels):** Add a GIN trigram index (`CREATE INDEX idx_reels_hook_trgm ON reels USING GIN (hook gin_trgm_ops)`) or switch to full-text search

### R7: Mobile Layout
The three-column studio layout doesn't work on mobile. The chat interface should collapse to a single column with the sidebar as a slide-over drawer. This is additional scope — flag for a follow-up pass.

### R8: Existing `POST /api/generation` Backward Compatibility
The existing generation endpoint remains unchanged. The new chat route is additive. `generatedContent` table gains rows from both the old endpoint and the new chat flow (linked via `chatMessages.generatedContentId`).

---

## Implementation Sequence

```
Phase 1: Data Foundation
  1. DB schema (4 new tables + indexes + relations)
  2. Run migrations (bun db:generate && bun db:migrate)

Phase 2: Backend APIs
  3. Projects route (CRUD)
  4. User Niches route (CRUD)                    [parallel with 3]
  5. Reel search endpoint (GET /api/reels/search) [parallel with 3]
  6. Chat prompt file (chat-generate.txt)         [parallel with 3]
  7. Chat route (sessions CRUD + streaming messages)

Phase 3: Frontend
  8.  Feature folder structure + types
  9.  Query keys
  10. use-projects hook
  11. use-chat-sessions hook
  12. use-chat-stream hook (useChat wrapper)
  13. ProjectSidebar component
  14. ChatPanel + ChatMessage + ChatInput
  15. ReelPickerModal + ReelReferenceChip
  16. Replace generate.tsx route
  17. i18n translation keys

Phase 4: Polish
  18. Interrupted stream recovery UI
  19. Session rename
  20. Mobile responsive adjustments
```

### MVP Scope (Minimum to Ship)

If cutting scope, the minimum viable chat interface is:

1. DB schema (all 4 tables — don't defer, the model is needed)
2. Projects route (create + list only)
3. Chat route (create session + send message with streaming)
4. Frontend: ProjectSidebar (simplified) + ChatPanel + ChatInput
5. Replace generate.tsx

**Defer to follow-up:**
- Reel referencing (picker modal + `@` search)
- User niche preferences
- Session rename
- Mobile layout
- Image generation

---

## Cost Estimate

### AI API Costs (Monthly, at Scale)

Assuming 1,000 active users, 5 messages/user/day:
- ~150,000 messages/month
- ~500 input tokens + ~300 output tokens per message average
- GPT-4o-mini: ~$0.15/1M input + $0.60/1M output
- **~$0.15 * 75 + $0.60 * 45 = ~$38/month** at GPT-4o-mini pricing

This is very cheap. Even at 10x scale it's under $400/month.

### Infrastructure

No new services needed — the chat route runs in the existing Hono backend. Streaming holds connections open longer (5-15s) but Railway handles concurrent connections well. At 1,000 concurrent users with staggered requests, peak concurrent streams would be ~50-100 — well within a single instance.
