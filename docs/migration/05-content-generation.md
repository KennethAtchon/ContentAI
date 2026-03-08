# 05 — Content Generation Engine

## Goal

Let users take any analyzed reel and generate original remix variations — new hooks, captions, scripts — adapted from the viral structure without copying the original content. This is the core user-facing AI feature.

---

## What "Generate" Means

The user selects a source reel, sees its analysis (hook pattern, emotional trigger, etc.), and types a generation prompt like:

> "Adapt this hook for beginner investors, keep it under 15 seconds"

The AI returns:
- **Generated Hook** — a new first-line hook using the same structural pattern
- **Generated Caption** — a full caption using the same framework (Problem → Proof → Solution → CTA)
- **Script notes** — optional bullet points for the video body

The output is original — same structure, different content.

---

## Backend: Generation Endpoint

**`backend/src/routes/generation.ts`**

```
POST /api/generation       → generate content
GET  /api/generation       → list user's history (paginated)
GET  /api/generation/:id   → single generated output
```

### `POST /api/generation`

Request body:
```typescript
{
  sourceReelId: number;
  prompt: string;               // user's natural language instruction
  outputType: "hook" | "caption" | "full" | "script";
}
```

Auth: `requireAuth`

Rate limiting: 20 generations per user per day (Redis counter, reset at midnight UTC).

### Generation Service

**`backend/src/services/content-generator.ts`**

```typescript
async function generateContent(params: {
  reel: Reel;
  analysis: ReelAnalysis;
  prompt: string;
  userId: string;
  outputType: OutputType;
}): Promise<GeneratedContent>
```

#### AI Call

Model: `claude-sonnet-4-6` (higher quality for user-facing output)

System prompt (`backend/src/prompts/remix-generation.txt`):
```
You are an expert viral content strategist. You create original short-form video content
that engineers retention through proven structural patterns.

CRITICAL: You produce ORIGINAL content inspired by viral structures — never copy or
closely paraphrase existing content. Model the formula, not the words.

Given a source reel's analysis and a user instruction, generate:
1. A powerful hook (1-2 sentences, first 2-3 seconds)
2. A full caption using the same structural framework
3. Optional: script bullet points for the video body

Follow the exact hook pattern and emotional trigger from the analysis.
Use the same CTA type. Write for the user's specified angle.

Respond in JSON:
{
  "hook": "...",
  "caption": "...",
  "scriptNotes": ["...", "..."]  // optional bullet points
}
```

User message template:
```
Source Reel Analysis:
- Niche: {{niche}}
- Hook Pattern: {{hookPattern}} ({{hookCategory}})
- Emotional Trigger: {{emotionalTrigger}}
- Format: {{formatPattern}}
- CTA Type: {{ctaType}}
- Caption Framework: {{captionFramework}}

Original Hook (for structural reference only — do NOT copy):
"{{hook}}"

User Instruction:
{{prompt}}

Generate an original variation following the same viral structure.
```

### Storing Output

Write to `generated_content` table:
```typescript
{
  userId,
  sourceReelId,
  prompt,
  generatedHook,
  generatedCaption,
  generatedScript: JSON.stringify(scriptNotes),
  model: GENERATION_MODEL,
  status: "draft",
}
```

Return the full `GeneratedContent` record.

---

## Specialized AI Tools

The left sidebar has quick-access tools: Hook Writer, Caption AI, Remix, Voice-over, Scheduler.

Each maps to a focused generation mode:

### Hook Writer (`outputType: "hook"`)
Generates 5 hook variations using the same pattern. Good for A/B testing.

Prompt: `backend/src/prompts/hook-writer.txt`
```
Generate 5 distinct hook variations for a {{niche}} Reel using the "{{hookPattern}}" pattern.
Each hook should use a different specific angle or example.
Respond as a JSON array of 5 strings.
```

### Caption AI (`outputType: "caption"`)
Generates a full caption only. Uses the `captionFramework` from analysis.

### Remix (`outputType: "full"`)
Full generation — hook + caption + script notes. Default flow.

### Voice-over (future)
Generates a spoken script formatted for TTS. Placeholder in this phase.

### Scheduler (→ step 06)
Sends the generated content to the queue. Not an AI call — a routing action.

---

## Frontend: Generate Panel

The right panel's "Generate" tab is the primary UI for this feature.

### Components

**`frontend/src/features/generation/components/GeneratePanel.tsx`**

Renders:
- Prompt textarea (from `AIStudioDesign.jsx`'s `.ais-generate-input`)
- Generate button with loading progress bar animation (`.ais-generating-bar`)
- Output display (`.ais-generated-result`)
- "Add to Queue" button below output
- Tool shortcut buttons (Hook × 5, Caption only, Full)

### Mutation

```typescript
const { authenticatedFetch } = useAuthenticatedFetch();

const generateMutation = useMutation({
  mutationFn: async (params: GenerateParams) => {
    const res = await authenticatedFetch("/api/generation", {
      method: "POST",
      body: JSON.stringify(params),
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.api.generationHistory(userId) });
  },
});
```

### Loading State

Mirror the `ais-generating-bar` animation from the design:
- Button shows "Generating..." text
- Animated progress bar sweeps left-to-right over ~2 seconds
- Panel shows a skeleton while waiting for response

### Output Display

When generation completes, show:
- Hook in large bold text
- Caption in smaller muted text
- "Copy Hook", "Copy Caption", "Add to Queue" action buttons

---

## History Tab

`GET /api/generation?limit=20&offset=0` returns the user's generation history.

Display as a list in the right panel "History" tab:
- Generated hook (truncated)
- Source reel username
- Generated at timestamp
- Status badge (draft / queued / posted)
- Click to expand full output

---

## Rate Limiting UX

When a user hits their daily limit (20 generations), return HTTP 429.

Frontend handles 429 by showing a toast notification:
> "Daily generation limit reached. Resets at midnight UTC."

---

## Acceptance Criteria

- [ ] `POST /api/generation` returns generated hook + caption in under 10 seconds
- [ ] Output is stored in `generated_content` table with correct `userId`
- [ ] Rate limit (20/day) enforced server-side; 429 returned when exceeded
- [ ] Frontend shows progress bar animation during generation
- [ ] Generated output renders in the panel with copy buttons
- [ ] "Add to Queue" button transitions content to `status: "queued"`
- [ ] History tab loads and paginates user's generated content
- [ ] Hook Writer tool generates 5 variations when selected
