# 04 — AI Analysis Layer

## Goal

For each reel, run an AI pipeline that extracts its structural viral formula: hook pattern, emotional trigger, format, CTA, caption framework, and a remix suggestion. This is the core value of the platform.

---

## What the Analysis Extracts

Given a reel (hook text, caption, audio name, video length, engagement metrics):

```
Hook Pattern:       "If you are X, stop doing Y"
Hook Category:      Warning Hook
Emotional Trigger:  Fear + Authority
Format Pattern:     Fast-cut talking head
CTA Type:           Save / Share
Caption Framework:  Problem → Proof → Solution → CTA
Curiosity Gap:      "What happens next?" style open loop
Remix Suggestion:   [AI-generated variation idea for this niche]
```

---

## Backend Service

**`backend/src/services/reel-analyzer.ts`**

Main entry point:
```typescript
async function analyzeReel(reelId: number): Promise<ReelAnalysis>
```

### Input

Fetches from DB:
- `hook` — first 2–3 seconds of on-screen text
- `caption` — full caption text
- `audioName` — audio track name
- `views`, `likes`, `comments`, `engagementRate`

### AI Call

Use Claude API (`claude-sonnet-4-6` or `claude-haiku-4-5` for cost efficiency on bulk runs).

System prompt (stored in `backend/src/prompts/reel-analysis.txt`):
```
You are a viral content analyst. Given a short-form video's hook, caption, and metrics,
extract the structural elements that made it go viral.

Respond in JSON with these exact keys:
- hookPattern: a concise label for the hook formula (e.g., "If X Stop Y", "Top N List", "POV Transformation")
- hookCategory: one of [Warning, Authority, Question, Curiosity, List, POV, MythBust, Social Proof]
- emotionalTrigger: primary emotions triggered, comma-separated (Fear, Curiosity, Aspiration, Authority, Shock, FOMO)
- formatPattern: video format (Fast-cut talking head, Single-shot, B-roll overlay, Text-only, Reaction)
- ctaType: primary call to action type (Save, Comment, Share, Tag, Follow)
- captionFramework: caption structure pattern
- curiosityGapStyle: how the hook opens a loop (or null)
- remixSuggestion: a specific, actionable suggestion to adapt this for a new variation. Be concrete.
```

User message template:
```
Niche: {{niche}}
Hook: {{hook}}
Caption: {{caption}}
Audio: {{audioName}}
Views: {{views}} | Engagement: {{engagementRate}}%

Analyze this viral reel and return structured JSON.
```

### Output

Parse JSON response, validate with Zod, write to `reel_analyses` table.

Store `rawResponse` for debugging.

---

## Service Integration Points

### Triggered automatically after scan

When a niche scan completes and new reels are inserted, the scanner service queues analysis jobs for each new reel:

```typescript
// in reel-scanner.ts after bulk insert:
for (const reel of insertedReels) {
  await analysisQueue.add("analyze-reel", { reelId: reel.id });
}
```

### Triggered on-demand from frontend

`POST /api/analysis/:reelId` — user clicks "Analyze" on a reel that hasn't been analyzed yet.

Protected with `requireAuth`. Rate-limited: 10 analysis requests per user per hour (Redis counter).

---

## Prompt Management

Store all AI prompts as `.txt` files under `backend/src/prompts/`. Load them at startup, not at request time.

```
backend/src/prompts/
  reel-analysis.txt       ← system prompt for structural analysis
  remix-generation.txt    ← system prompt for content generation (step 05)
  hook-writer.txt         ← system prompt for hook-only generation
  caption-writer.txt      ← system prompt for caption generation
```

Utility: `backend/src/utils/prompts.ts`
```typescript
export function loadPrompt(name: string): string  // reads file, caches in memory
```

---

## Claude API Setup

Add to `backend/src/utils/config/envUtil.ts`:
```typescript
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "claude-haiku-4-5-20251001";
export const GENERATION_MODEL = process.env.GENERATION_MODEL ?? "claude-sonnet-4-6";
```

Use `claude-haiku-4-5` for bulk analysis (cost-efficient), `claude-sonnet-4-6` for user-facing generation.

Create `backend/src/lib/claude.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/utils/config/envUtil";

export const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
```

Install SDK:
```bash
cd backend && bun add @anthropic-ai/sdk
```

---

## Frontend Integration

The analysis panel right-side of the studio shows analysis data.

### Fetching

```typescript
const { data: analysis } = useQuery({
  queryKey: queryKeys.api.reelAnalysis(reelId),
  queryFn: () => fetcher(`/api/analysis/${reelId}`),
  enabled: !!reelId,
});
```

### UI State: Analysis Loading

When a reel has no analysis yet, show a "Run Analysis" button in the panel. On click:
- Call `POST /api/analysis/:reelId` using `authenticatedFetch`
- Optimistically show a loading skeleton in the panel
- Invalidate `queryKeys.api.reelAnalysis(reelId)` on success

### Analysis Tags Component

`frontend/src/features/reels/components/AnalysisTags.tsx`

Renders hook category, emotional trigger, and format as pill badges using the indigo/purple palette from the design.

---

## Hook Category Color Map

Apply consistent colors per hook category:
- Warning → red-tinted `rgba(239,68,68,0.15)` border
- Authority → indigo `rgba(129,140,248,0.15)`
- Question → amber `rgba(245,158,11,0.15)`
- Curiosity → purple `rgba(192,132,252,0.15)`
- List → teal `rgba(20,184,166,0.15)`
- POV → sky `rgba(56,189,248,0.15)`
- MythBust → orange `rgba(249,115,22,0.15)`

---

## Acceptance Criteria

- [ ] `POST /api/analysis/:reelId` calls Claude and stores result in `reel_analyses`
- [ ] `GET /api/reels/:id` returns `analysis` field populated after analysis runs
- [ ] Analysis panel shows all extracted fields (hookPattern, emotionalTrigger, formatPattern, etc.)
- [ ] "Run Analysis" button appears when `analysis === null`; disappears after analysis completes
- [ ] Analysis jobs are queued automatically after a niche scan
- [ ] Rate limiting on analysis endpoint enforced per user
- [ ] `rawResponse` stored in DB for debugging
