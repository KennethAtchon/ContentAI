# AI Integration Refactor Research

**Date:** 2026-03-19
**Scope:** Backend AI orchestration, tool design, frontend stream handling, and provider management

---

## Executive Summary

ContentAI has a solid AI foundation: multi-provider fallback, streaming with tool calling, DB-backed runtime config, cost tracking, and versioned content iteration. However, several architectural issues limit scalability and user capability:

1. **Tooling gap** — the AI cannot perform targeted field edits (e.g., "rewrite just the caption"). Users are forced to regenerate everything to change one field.
2. **Sync/async config split** — streaming uses ENV-loaded config instead of DB-backed runtime config, making admin-panel changes ineffective for live streaming sessions.
3. **Duplicate logic** — token extraction, pagination, and cost formatting are repeated across files.
4. **Fragile XML filtering** — client strips `<tool_call>` blocks as a workaround for non-native-calling models.
5. **No transaction safety** — multi-step DB writes (content + queue) can produce orphaned rows on crash.

---

## Part 1: Current Architecture

### Provider Stack

```
Admin Panel → systemConfig (DB) → Redis (60s TTL) → getProviderInstanceAsync()
                                                         ↕
                                               AI SDK (Vercel AI SDK)
                                                    ↙  ↓  ↘
                                               OpenAI  Claude  OpenRouter
```

Two config paths exist (a known tech debt):
- **Async (DB-backed):** Used for non-streaming routes (analysis, remix generation)
- **Sync (ENV-backed):** Still used by the streaming chat route — admin panel changes do **not** affect live chat until server restart

### Chat Tool Inventory (Current)

| Tool | Purpose | Fields Affected |
|---|---|---|
| `save_content` | Persist new generation to DB | All fields: hook, script, cleanScript, sceneDescription, caption, hashtags, cta |
| `get_reel_analysis` | Fetch reel viral analysis | Read-only |
| `iterate_content` | Create versioned copy with changed fields | Any subset of all fields |

**Gap:** `iterate_content` replaces entire fields. There is no targeted instruction tool like "shorten the caption" or "make the CTA more urgent." The AI must infer the full new value and pass all desired content together — it cannot read the current value of a single field and patch it.

### Frontend Stream Handling

The stream hook (`use-chat-stream.ts`) reads the POST response body as SSE-style lines (`drainSseStreamIntoIngest` → `processStreamSseLine`) and:
1. Appends `text-delta` chunks to accumulated assistant text (shown as the streaming overlay)
2. Strips `<tool_call>...</tool_call>` XML blocks (`filterToolCallXml`)
3. Detects content-writing tools from text deltas and tool events for the saving indicator / `streamingContentId`
4. On 403 with `USAGE_LIMIT_REACHED`, sets `isLimitReached` and invalidates usage queries

---

## Part 2: Bugs & Code Quality Issues

### B1: Streaming Uses Sync Config (High Impact)

**File:** `backend/src/lib/aiClient.ts` + `backend/src/routes/chat/index.ts`

`getModel()` / `getModelInstance()` are synchronous and read from ENV vars loaded at startup. The async `getProviderInstanceAsync()` exists and uses DB-backed config with Redis caching, but the chat streaming route still calls the sync version.

**Effect:** If an admin updates the AI model or API key via `/api/admin/config`, the streaming chat endpoint continues using the old value until the server restarts.

**Fix:** Resolve the model before calling `streamText()` using `await getProviderInstanceAsync()`. The model object returned by the AI SDK is a value, not a connection — it can be resolved async then passed to `streamText` synchronously.

```typescript
// Before (sync, ENV-only)
const model = getModelInstance("generation");

// After (async, DB-backed)
const { model } = await getProviderInstanceAsync("generation");
```

---

### B2: XML Tool Call Stripping (Medium Impact)

**File:** `frontend/src/features/chat/hooks/use-chat-stream.ts` (`filterToolCallXml`, used from `processStreamSseLine`)

A client-side regex strips `<tool_call>...</tool_call>` blocks from streamed text. This exists because some OpenRouter models without native function calling emit tool invocations as raw XML text in the content stream.

**Risks:**
- If a user's caption or hook legitimately contains `<tool_call>` text, it is silently removed
- It creates a dependency: the XML format must match exactly what the model emits
- It couples frontend rendering logic to a backend provider quirk

**Fix:** Enforce native function calling for all configured models. In `config.ts` (and DB config), ensure only models with native tool calling support are allowed. Add a validation step in `getProviderInstanceAsync()` that rejects model configs missing native tool support. Remove the client-side strip.

If OpenRouter models without native calling must be supported, move the XML parsing to the **backend** SSE stream transformer — never the client.

---

### B3: No Transaction Safety for Multi-Step Writes (Medium Impact)

**File:** `backend/src/lib/chat-tools.ts:90-116` (save_content), `:376-383` (iterate_content)

Both tools insert into `generatedContent`, then immediately update `queueItems` and status in separate queries. If the process crashes between steps, the content row exists but the queue entry does not.

**Fix:** Wrap in `db.transaction()`:

```typescript
await db.transaction(async (tx) => {
  const [content] = await tx.insert(generatedContent).values({...}).returning();
  await tx.insert(queueItems).values({ contentId: content.id, ... });
});
```

---

### B4: Content Type Enum Mismatch (Medium Impact)

**Files:**
- `backend/src/lib/chat-tools.ts:57` — uses `"hook_only"`, `"caption_only"`, `"full_script"`
- `backend/src/services/reels/content-generator.ts:13` — uses `"hook"`, `"caption"`, `"full"`

Both write to `generatedContent.outputType`. The field can contain values from two different enums depending on which code path created the row.

**Fix:** Pick one canonical set of values, update the Drizzle enum, run a migration to normalize existing rows, then remove the other set.

---

### B5: Duplicate Token Extraction Logic (Low Impact)

**Files:** `backend/src/lib/aiClient.ts` and `backend/src/routes/chat/index.ts`

Both implement logic to extract input/output token counts from provider responses, handling the OpenAI vs Anthropic field name differences (`inputTokens` vs `promptTokens`).

**Fix:** Move to a single utility function in `backend/src/lib/ai/helpers.ts` and import it in both places.

```typescript
// backend/src/lib/ai/helpers.ts
export function extractTokenUsage(usage: unknown): { inputTokens: number; outputTokens: number } {
  const u = usage as Record<string, number>;
  return {
    inputTokens: u.inputTokens ?? u.promptTokens ?? 0,
    outputTokens: u.outputTokens ?? u.completionTokens ?? 0,
  };
}
```

---

### B6: Closure Variable for Saved Content ID (Low Impact)

**File:** `backend/src/routes/chat/index.ts:566,569-579`

`savedContentId` is declared in the route handler scope and written by the `save_content` tool handler closure. This works because tools execute sequentially (enforced by `stepCountIs(5)`), but it's a fragile implicit pattern — if the step count changes or parallelism is introduced, this becomes a race condition.

**Fix:** Use a results accumulator object passed into `createChatTools()`:

```typescript
const toolResults = { savedContentId: null as number | null };
const tools = createChatTools({ ...toolContext, toolResults });
// Tool writes to toolResults.savedContentId
// onFinish reads from toolResults.savedContentId
```

---

### B7: Parent Chain Traversal Uses Iterative Loop (Low Impact)

**File:** `backend/src/lib/chat-tools.ts:300-332`

`MAX_CHAIN_DEPTH = 50` is used to walk the parent chain and find the latest content version tip. This issues up to 50 individual DB queries in a loop.

**Fix:** Replace with a single recursive CTE query:

```sql
WITH RECURSIVE chain AS (
  SELECT id, parent_id FROM generated_content WHERE id = $startId
  UNION ALL
  SELECT c.id, c.parent_id FROM generated_content c JOIN chain ON c.parent_id = chain.id
)
SELECT id FROM chain WHERE id NOT IN (SELECT parent_id FROM generated_content WHERE parent_id IS NOT NULL)
LIMIT 1;
```

This resolves the full chain in a single round trip and is not vulnerable to loops (DB CTE handles cycles via deduplication).

---

## Part 3: New Tooling Required

The most impactful gap in the current AI system: **the AI cannot perform targeted, field-level edits.** A user saying "edit the caption to be shorter" forces the AI to reproduce all other fields unchanged via `iterate_content` — or risk silently resetting them.

### T1: `edit_content_field` Tool (High Priority)

A surgical tool for patching one or more specific fields of existing content without touching the rest.

**When to use:** User says anything like:
- "edit the caption to..."
- "make the hook more aggressive"
- "change the hashtags to focus on fitness"
- "rewrite the CTA as a comment prompt"
- "update the script to be 30 seconds shorter"

**Schema:**

```typescript
const editContentFieldTool = {
  description: `
    Edit one or more specific fields of existing generated content without changing other fields.
    Use this when the user wants to modify a specific part (e.g., caption, hook, CTA, hashtags)
    without regenerating the entire piece. Always prefer this over iterate_content when only
    1-3 fields are being changed.
  `,
  parameters: z.object({
    contentId: z.number().describe("ID of the content to edit"),
    edits: z.object({
      hook: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      script: z.string().optional(),
      cleanScript: z.string().optional(),
      sceneDescription: z.string().optional(),
    }).describe("Only include fields that are being changed"),
    changeDescription: z.string().describe("What was changed and why, e.g., 'shortened caption and made CTA more direct'"),
  }),
};
```

**Behavior:**
- Reads current content by ID
- Merges edits over existing values (explicit patch, not replace-all)
- Creates a new versioned row (same as `iterate_content`) so no history is lost
- Returns new content ID for confirmation

**Implementation location:** `backend/src/lib/chat-tools.ts`

---

### T2: `get_content` Tool (High Priority)

Currently, the AI cannot inspect what has already been generated in the active session unless the user quotes it. This forces the AI to re-derive context it should already have access to.

**When to use:**
- User references "my current caption" or "what you just wrote"
- User asks "what hashtags did you pick?"
- AI needs to read current content before making targeted edits

**Schema:**

```typescript
const getContentTool = {
  description: `
    Retrieve the current content for a given content ID. Use this before making targeted edits
    so you can read the existing values and understand what to preserve vs change.
  `,
  parameters: z.object({
    contentId: z.number().describe("ID of the content to retrieve"),
  }),
};
```

**Returns:** Full content object (hook, caption, script, cleanScript, hashtags, cta, sceneDescription, version, status)

**Security:** Only return content owned by the authenticated user.

---

### T3: `update_content_status` Tool (Medium Priority)

Users should be able to tell the AI "mark this as ready" or "move this to the queue" or "archive it."

**Schema:**

```typescript
const updateContentStatusTool = {
  description: `
    Update the status of a piece of generated content.
    Use when the user says "move this to the queue", "mark it as ready", "archive this", etc.
  `,
  parameters: z.object({
    contentId: z.number(),
    status: z.enum(["draft", "queued", "archived"]).describe("New status"),
  }),
};
```

---

### T4: `search_content` Tool (Medium Priority)

Users should be able to say "find the reel I made about fitness last week" or "show me all my captions from this project."

**Schema:**

```typescript
const searchContentTool = {
  description: `
    Search through the user's previously generated content. Use when the user references past
    content they want to find, compare, or build on.
  `,
  parameters: z.object({
    query: z.string().optional().describe("Text to search in hooks, captions, scripts"),
    sourceReelId: z.number().optional().describe("Filter by source reel"),
    status: z.enum(["draft", "queued", "processing", "published"]).optional(),
    limit: z.number().max(10).default(5),
  }),
};
```

---

### T5: `schedule_content` Tool (Low Priority / Future)

Once scheduling is supported, the AI should be able to schedule a post when a user says "post this on Tuesday at 3pm."

---

## Part 4: Provider Config Scalability

### Add Model Capability Registry

Currently, models are stored as plain strings in config. There is no machine-readable record of which models support:
- Native function calling
- Streaming with tool use
- Vision/multimodal input
- Maximum context length

This is why the XML tool call filtering exists — there's no way to programmatically gate which models are used in which contexts.

**Proposed:** A capability registry in `backend/src/lib/ai/model-registry.ts`:

```typescript
type ModelCapabilities = {
  supportsNativeToolCalling: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  tier: "analysis" | "generation" | "both";
};

const MODEL_REGISTRY: Record<string, ModelCapabilities> = {
  "gpt-4o": { supportsNativeToolCalling: true, supportsStreaming: true, supportsVision: true, maxContextTokens: 128000, maxOutputTokens: 4096, tier: "both" },
  "gpt-4o-mini": { supportsNativeToolCalling: true, supportsStreaming: true, supportsVision: true, maxContextTokens: 128000, maxOutputTokens: 4096, tier: "analysis" },
  "claude-sonnet-4-6": { supportsNativeToolCalling: true, supportsStreaming: true, supportsVision: true, maxContextTokens: 200000, maxOutputTokens: 8192, tier: "both" },
  // ...
};
```

`getProviderInstanceAsync()` would validate the resolved model against this registry and reject configs that select a non-tool-calling model for the streaming chat route.

### Make Provider Priority Explicit by Use Case

Currently, one priority array (`["openai", "claude", "openrouter"]`) governs all AI calls. But analysis (non-streaming) and generation (streaming) have different requirements.

**Proposed:** Separate priority configs:
- `ai.chat_provider_priority` — must support streaming + native tool calling
- `ai.analysis_provider_priority` — simpler, can be async, cheaper models preferred

---

## Part 5: Prompt Management

The four prompts in `backend/src/prompts/` are loaded from disk on every cold start. No issues today, but as the system grows:

1. **Version prompts** — when refining `chat-generate.txt`, there's no history of what changed. Consider storing prompt versions in DB or tracking in git with meaningful commit messages.

2. **Add prompt for targeted field edits** — the new `edit_content_field` tool needs a prompt section explaining when to use it vs `iterate_content`.

3. **Document prompt constraints** — `chat-generate.txt` has quality standards but no explicit length guidance (max hook chars, max caption lines). Add these as numeric constants referenced both in the prompt and validated in the tool schema.

---

## Part 6: Recommended Implementation Order

### Sprint 1 — Correctness (Fix now)

| ID | Task | Files | Effort |
|---|---|---|---|
| B3 | Wrap save_content + iterate_content in DB transaction | `chat-tools.ts` | S |
| B4 | Unify outputType enum, run migration | `schema.ts`, `chat-tools.ts`, `content-generator.ts` | M |
| B5 | Extract token usage utility | `ai/helpers.ts`, `aiClient.ts`, `chat/index.ts` | S |

### Sprint 2 — High-Value Tooling (User capability)

| ID | Task | Files | Effort |
|---|---|---|---|
| T1 | Implement `edit_content_field` tool | `chat-tools.ts`, `prompts/chat-generate.txt` | M |
| T2 | Implement `get_content` tool | `chat-tools.ts` | S |
| T3 | Implement `update_content_status` tool | `chat-tools.ts` | S |
| B1 | Migrate streaming to async DB-backed config | `chat/index.ts`, `ai/helpers.ts` | M |

### Sprint 3 — Robustness & Scale

| ID | Task | Files | Effort |
|---|---|---|---|
| T4 | Implement `search_content` tool | `chat-tools.ts` | M |
| B7 | Replace parent chain loop with recursive CTE | `chat-tools.ts` | S |
| B6 | Replace closure var with results accumulator | `chat/index.ts`, `chat-tools.ts` | S |
| — | Add model capability registry | new: `ai/model-registry.ts` | M |
| B2 | Remove XML tool call strip from frontend | `use-chat-stream.ts` | S (after registry) |

### Sprint 4 — Architecture (Future)

| ID | Task |
|---|---|
| — | Separate provider priority by use case (chat vs analysis) |
| — | Add async job queue for non-streaming generation at scale |
| — | Prompt versioning strategy |
| T5 | Schedule content tool (when scheduling feature ships) |

---

## Appendix: Files to Touch per Sprint

**Sprint 1:**
- `backend/src/lib/chat-tools.ts`
- `backend/src/lib/ai/helpers.ts`
- `backend/src/lib/aiClient.ts`
- `backend/src/routes/chat/index.ts`
- `backend/src/infrastructure/database/drizzle/schema.ts`
- `backend/src/services/reels/content-generator.ts`
- Migration file (new)

**Sprint 2:**
- `backend/src/lib/chat-tools.ts` (add 3 new tools)
- `backend/src/prompts/chat-generate.txt` (update tool descriptions + usage rules)
- `backend/src/routes/chat/index.ts` (async config resolution)
- `backend/src/lib/ai/helpers.ts` (expose async config for streaming)

**Sprint 3:**
- `backend/src/lib/chat-tools.ts`
- `backend/src/lib/ai/model-registry.ts` (new)
- `backend/src/lib/ai/helpers.ts`
- `frontend/src/features/chat/hooks/use-chat-stream.ts`

---

## Studio generate: workspace UX (Mar 2026)

When chat tools persist content (`save_content`, `iterate_content`, `edit_content_field`), the UI does **not** auto-open the content workspace. **Once per chat session**, when the **first** draft id arrives from the stream, the “Open workspace” control plays a short highlight flicker (no toast; later saves in the same session do not repeat). Switching chat sessions clears stream state and aborts the in-flight request (`useChatStream` `sessionId` effect).

**Content assets:** API rows use `type` for storage kind (e.g. `audio` for library music) and `role` for semantic use (`voiceover`, `background_music`). The workspace audio UI and draft cards match **role** (with a legacy fallback on `type === "voiceover"` where needed). Assembled reels use `type === "assembled_video"` with `mediaUrl` for inline preview; **Draft detail** links to the Video tab via `onOpenVideo` from `ContentWorkspace` (`handleOpenVideo`). **Voiceover** auto-selects the first voice when the list loads (`VoiceoverGenerator`).
