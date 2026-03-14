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

### 7. AI Generation Quality — CRITICAL GAPS (Not Yet Built) ❌

These are the reason the AI produces generic output today. The UI exists, but the AI pipeline itself is broken in ways that make content quality poor regardless of how good the prompts are.

#### 7a. Conversation History Not Sent to Model

- [ ] **Pass full message history to `streamText`** — currently every chat message is a single-turn call. The AI has zero memory of anything said before. "Make it shorter", "try a different hook", "use a more aggressive tone" — none of these work. Fix: load all previous `chatMessages` for the session from DB and pass them as the `messages` array to `streamText`.

> **This is the single highest-impact fix.** Without it, the Generate tab is not a chat — it's a stateless autocomplete box that forgets everything between turns.

```
// Current (broken):
messages: [{ role: "user", content: userPrompt }]

// Required:
messages: [
  ...previousMessages.map(m => ({ role: m.role, content: m.content })),
  { role: "user", content: userPrompt }
]
```

#### 7b. Reel Analysis Data Not Injected Into Context

- [ ] **Include full `reelAnalysis` data in `buildChatContext`** — the `reelAnalyses` table has rich data (`hookCategory`, `emotionalTrigger`, `formatPattern`, `ctaType`, `remixSuggestion`, `captionFramework`, `curiosityGapStyle`) that is never sent to the AI. Currently only `username`, `views`, `niche`, and `hook` are included. Fix: when `reelRefs` are present, also fetch + format their analysis rows.

```
// What the AI gets today:
"Reel @creator (2.1M views, fitness): hook='I tried this for 30 days'"

// What it should get:
"Reel @creator (2.1M views, fitness):
  hook: 'I tried this for 30 days'
  hookCategory: Warning
  emotionalTrigger: fear-of-missing-out, curiosity
  formatPattern: before/after
  ctaType: save
  remixSuggestion: 'Adapt for a 7-day challenge format with daily check-ins'"
```

#### 7c. Structured Output Not Parsed Back Into Fields

- [ ] **Parse AI response sections into DB fields** — `onFinish` currently saves the entire raw `text` into `generatedScript` and makes a naive guess at `generatedHook` (first line). The system prompt instructs the model to output `**HOOK**`, `**CAPTION**`, `**HASHTAGS**`, `**CTA**` sections — these should be extracted with a regex parser and stored in the correct `generatedHook`, `generatedCaption`, `generatedScript` columns. This enables the "Send to queue" preview to show the actual hook instead of the first sentence of whatever the AI wrote.

```
// Parse sections from structured output:
const hook = text.match(/\*\*HOOK\*\*[^\n]*\n([\s\S]*?)(?=\*\*[A-Z])/)?.[1]?.trim()
const caption = text.match(/\*\*CAPTION\*\*[^\n]*\n([\s\S]*?)(?=\*\*[A-Z])/)?.[1]?.trim()
```

#### 7d. Output Token Cap Too Low for Full Scripts

- [ ] **Increase `maxOutputTokens` from 1024 to 2048** — a structured script with HOOK + SHOT LIST + CAPTION + HASHTAGS + CTA routinely hits 1024 tokens and gets silently truncated. The frontend shows a cut-off response with no indication that the output was incomplete.

#### 7e. System Prompt Too Generic

- [ ] **Enrich `chat-generate.txt`** with niche-awareness, iteration instructions, and explicit formatting rules. The current prompt has no instruction to use the reel analysis data that will now be in context, no instruction to adapt tone based on niche, and no instruction for follow-up turns ("if the user asks to modify the previous output, reference it explicitly and change only what was asked").

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
- [x] **Iterate without losing history** — when you ask the AI to rewrite something, each version is saved as a trail. You can see the lineage in your queue instead of losing earlier drafts. *(version + parentId wired; conversation history not yet sent to AI — see §7a)*
- [x] **Send generated scripts directly to your queue** — one button, instant Draft. No manual copy-pasting from chat to elsewhere.
- [x] **Search your queue** — find any script by hook text or project name, regardless of how many items you have.
- [x] **Know when you're running low** — a banner warns you at 80% of your limit so you're never blindsided mid-session.
- [x] **Smoother Discover scrolling** — no memory accumulation from scrolled-past reels, regardless of session length.
- [ ] **Actually iterative AI chat** — "make it shorter", "try a different hook", "use a more aggressive tone" work as expected. *(blocked by §7a — conversation history)*
- [ ] **AI that knows the reel's analysis** — generated content reflects the hookCategory, emotional triggers, and format patterns of the reels you referenced. *(blocked by §7b — analysis context)*
- [ ] **Correctly parsed queue previews** — the hook shown on your queue card is the actual hook from the script, not just the first line of the AI's raw response. *(blocked by §7c — output parsing)*
