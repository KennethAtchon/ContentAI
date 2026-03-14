# MVP 2 — Close the Loop

*The core promise of ContentAI is: discover what's working → understand why → generate your own version. MVP 1 built all three capabilities in isolation. MVP 2 makes them one continuous, frictionless workflow — and turns generated content into something a creator can actually act on.*

---

## What We're Building

### 1. Discover → Generate Bridge ✅

- [x] Replace "Run AI Analysis" button in `AnalysisPanel` with a single **"Generate from this reel"** action — runs analysis, auto-creates a named project, opens a pre-loaded chat session, navigates to `/studio/generate?projectId=X&sessionId=Y`
- [x] **Confirmation modal** before the redirect — explains that a new project + session will be created, with Cancel / Continue buttons

> This is the most important feature in MVP 2. Without it, Discover and Generate feel like two separate apps.

---

### 2. Reel Referencing in Chat ✅

- [x] **"Attach Reel" button** with searchable modal in the chat input — browse and attach any saved reel as context for the current message
- [x] **Visual reel cards** — when a reel is attached/referenced it renders as a card (hook, views, niche) rather than a raw ID
- [ ] **`@` mention** with debounced fuzzy search — reference reels inline mid-prompt without breaking writing flow, with niche filtering *(Attach Reel button added; inline `@` popover deferred — input currently inserts `@username` text but has no autocomplete dropdown)*

> This is how users will get high-quality generations — referencing specific reels rather than describing them in prose.

---

### 3. Content Iteration & Export ✅

- [x] **Content iteration linked to parent version** — every AI response in chat auto-creates a `generatedContent` row with `version` + `parentId` wired; new iterations get `version + 1`
- [x] **"Send to queue" button** on any generated output — creates a queue item in Draft status, bridging Generate → Queue

> Export to queue is the second most important feature in MVP 2. Without it, generated content exists only in chat history and never becomes actionable.

---

### 4. Queue — Minimum Viable Usability ✅

- [x] **Version number on queue cards** — show "v2", "v3" so users can see iteration history at a glance
- [x] **Duplicate queue item** — one-click duplication for A/B variations without re-generating
- [x] **Search in queue** — text search across hook + project name; users with 15+ items hit a usability wall without it

---

### 5. Discover Feed Performance ✅

- [x] **Virtualize the TikTok feed** — replaced DOM accumulation with `@tanstack/react-virtual`; removes CSS snap in favour of programmatic `scrollToIndex`

---

### 6. Upgrade Prompt UX ✅

- [x] **80% usage warning banner** — dismissible in-session banner when approaching generation/analysis limit
- [x] **Limit-hit modal** — proper upgrade modal when hard limit is reached (replaces abrupt 403 experience)

---

### 7. AI Tool Use ✅

The AI now uses Vercel AI SDK function calling. Three tools are registered in `streamText`: `save_content`, `get_reel_analysis`, and `iterate_content`. The `onFinish` regex-guessing approach has been removed. Structured `generatedHook`, `generatedCaption`, `generatedScript`, and `generatedMetadata` are written by `save_content.execute` with ownership and length guards.

---

#### Step 1 — Wire conversation history ✅

- [x] **`7e-1`** Last 20 messages loaded from DB before `streamText`. `reelRefs` stripped from history entries. History passed as `messages` array prefix; current message appended last.

---

#### Step 2 — Tools + onFinish cleanup ✅

- [x] **`7a-1`** `generatedContent` insert removed from `onFinish`. `onFinish` now only runs `recordUsage` (first) + insert assistant `chatMessage` (with `generatedContentId: savedContentId`) + `recordAiCost`.
- [x] **`7c-1`** Three tools registered: `save_content`, `get_reel_analysis`, `iterate_content`. `toolChoice: "auto"`, `stopWhen: stepCountIs(1)`. Response switched to `toUIMessageStreamResponse()` (SSE with typed JSON chunks).
- [x] **`7g-1`** `maxOutputTokens` raised to 2048.
- [x] **`7f-1`** `chat-generate.txt` rewritten: explicit rules for when to call each tool vs plain text; negative instruction against calling tools during conversation.

---

#### Step 3 — Frontend data stream parser ✅

- [x] **`7d-1`** `use-chat-stream.ts` parses SSE lines. `text-delta` chunks accumulate into displayed text. `tool-input-start` for `save_content`/`iterate_content` → `isSavingContent: true`. `tool-output-available` with `contentId` → `streamingContentId` set, `isSavingContent: false`.
- [x] **`7d-2`** `ChatMessage` shows spinner + "Saving content…" while `isSavingContent`. "Send to queue" button appears immediately using `streamingContentId` (no wait for `invalidateQueries`), falls back to `message.generatedContentId` for persisted messages.

---

#### Deferred tools (post-MVP)

| Tool | Why deferred |
|---|---|
| `search_reels` — AI autonomously searches DB by niche/keyword | Attach Reel modal covers primary use case; agentic search loop risk without clear user benefit yet |
| `get_my_generated_content` — AI browses user's generation history | No validated pain; adds context noise to every call |
| `get_trending_audio` — AI reads trending audio table | Audio pipeline explicitly deferred to Phase 3; tool has nothing to act on yet |

---

#### Risk register

| Risk | Mitigation |
|---|---|
| Double DB write (`onFinish` + `save_content` both fire) | Remove content insert from `onFinish` in the same PR as tool wiring — never ship tools without this |
| AI calls `save_content` multiple times in one turn | `maxSteps: 1` hard-limits the model to one tool call per streaming turn |
| `iterate_content` ownership bypass (integer IDs are guessable) | `execute` must verify `parentContentId` belongs to `auth.user.id` — return `{ error: "not_found" }`, never "unauthorized" (don't leak that the ID exists) |
| `get_reel_analysis` called for an arbitrary reel ID | `execute` verifies `reelId` is present in the current message's `reelRefs` before querying |
| Context cost blowout from full history | Cap at 20 messages; strip `reelRefs` from history entries; monitor p95 input tokens in `aiCostLedger` after shipping — reduce window to 10 if any session exceeds 8k input tokens |
| Usage gate bypass if `onFinish` crashes after tool write | Move `recordUsage` to the **first** operation in `onFinish`, before any DB work |

---

## What We're NOT Building (and why)

| Item | Reason |
|---|---|
| Audio production (Phase 3) / Video production (Phase 4) | Multi-month platform investment, no pipeline dependencies in place |
| System audio library | Depends on video pipeline — no surface to attach audio to yet |
| Calendar view + scheduling UI | Instagram publishing not wired end-to-end; scheduling theater on a non-functional pipeline |
| AI model selection per-request | No evidence of user pain, adds cost management risk |
| Advanced union trending / viral prioritization | Current freshness sort is good enough; optimization not new capability |
| Audio recommendation / Epidemic Sound | External licensing + recommendation engine — not buildable in scope |
| TypeScript strict mode, CI/CD, security hardening | Infrastructure sprint, not a product milestone |
| Mobile-first / PWA | No evidence of mobile usage yet |
| Inline `@` mention autocomplete popover | Attach Reel button covers the core use case; popover adds input complexity for marginal gain |

---

## What You Get at the End

From the user's perspective — what they can actually DO that they couldn't before:

- [x] **Find a reel, tap one button, land in Generate** — fully-configured session with the reel already analyzed and loaded as context. No copy-pasting, no manual project setup.
- [x] **Attach any reel mid-chat** — reel picker modal with niche filtering; attached reels render as visual cards and are sent to the AI as rich context.
- [x] **Iterate without losing history** — when you ask the AI to rewrite something, each version is saved as a trail. You can see the lineage in your queue instead of losing earlier drafts.
- [x] **Send generated scripts directly to your queue** — one button, instant Draft. No manual copy-pasting from chat to elsewhere.
- [x] **Search your queue** — find any script by hook text or project name, regardless of how many items you have.
- [x] **Know when you're running low** — a banner warns you at 80% of your limit so you're never blindsided mid-session.
- [x] **Smoother Discover scrolling** — no memory accumulation from scrolled-past reels, regardless of session length.
- [x] **AI that actually writes to your database** — generated hook, caption, script, and hashtags land in the correct DB fields via `save_content` tool calls, not regex guesswork.
- [x] **Actually iterative AI chat** — "make it shorter", "try a different hook", "use a more aggressive tone" work because the AI sees conversation history (last 20 messages) and calls `iterate_content` with the parent ID.
- [x] **AI that reads the reel's analysis on demand** — the model calls `get_reel_analysis` to fetch hookCategory, emotional triggers, and format patterns before generating.
- [x] **Correct queue previews** — the hook on your queue card is the actual hook the AI wrote, saved via `save_content` with guaranteed structure.
