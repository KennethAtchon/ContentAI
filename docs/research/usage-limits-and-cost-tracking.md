# Usage Limits & AI Cost Tracking

Hard-enforced subscription usage blockers and admin-facing AI cost tracking dashboard.

**Date:** 2026-03-12
**Status:** Research
**Related:** `backend/src/constants/subscription.constants.ts`, `backend/src/routes/customer/index.ts`, `backend/src/routes/admin/index.ts`

---

## Current State

### Subscription Tiers (Existing)

| Feature | Basic ($10/mo) | Pro ($25/mo) | Enterprise ($100/mo) |
|---------|---------------|-------------|---------------------|
| Calculations/month | 50 | 500 | Unlimited |
| Types | Loan | Loan + Investment | All |
| Exports | PDF | PDF/Excel/CSV | All + API |
| Support | Email | Priority | Dedicated |

**Problem:** These tiers are templated from a calculator product and don't map to ContentAI's actual features. They need to be redefined for reel generation.

### Usage Tracking (Existing)

- `GET /api/customer/usage` returns: reels analyzed, content generated, queue size
- `featureUsages` table tracks individual feature use events
- **No hard limits enforced** — the endpoint returns limits as `null` (unlimited)
- Admin can view feature usage records at `GET /api/admin/feature-usages`

---

## Redesigned Subscription Tiers

### Tier Definitions

| Feature | Free | Creator ($15/mo) | Pro ($35/mo) | Agency ($99/mo) |
|---------|------|-----------------|-------------|-----------------|
| AI Generations/month | 10 | 100 | 500 | Unlimited |
| Reel Analyses/month | 5 | 50 | 200 | Unlimited |
| TTS Voiceovers/month | 0 | 20 | 100 | Unlimited |
| AI Video Generations/month | 0 | 5 | 30 | 200 |
| Projects | 1 | 5 | 20 | Unlimited |
| Chat History | 7 days | 30 days | 90 days | Unlimited |
| Video Uploads | 0 | 10/mo | 50/mo | Unlimited |
| Export Quality | 720p | 1080p | 1080p | 4K |
| Audio Library | Basic | Full | Full | Full + Custom |
| Priority Generation | No | No | Yes | Yes |
| API Access | No | No | No | Yes |

**Rationale for pricing:**
- Free tier exists for trial/conversion (no Stripe trial needed — just a free plan)
- Creator at $15/mo covers AI costs (~$1/user/month for text generation) with healthy margin
- Pro at $35/mo is the sweet spot — video generation is the upsell
- Agency at $99/mo targets teams/agencies who need volume

### Implementation

**Modify `subscription.constants.ts`:**

```typescript
export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    limits: {
      generationsPerMonth: 10,
      analysesPerMonth: 5,
      ttsPerMonth: 0,
      videoGenerationsPerMonth: 0,
      projects: 1,
      chatHistoryDays: 7,
      videoUploadsPerMonth: 0,
      maxExportResolution: 720,
    },
  },
  creator: {
    name: "Creator",
    limits: {
      generationsPerMonth: 100,
      analysesPerMonth: 50,
      ttsPerMonth: 20,
      videoGenerationsPerMonth: 5,
      projects: 5,
      chatHistoryDays: 30,
      videoUploadsPerMonth: 10,
      maxExportResolution: 1080,
    },
  },
  // ... pro, agency
} as const;
```

**Update Stripe products** — create new products/prices in Stripe to match. Update `stripe.constants.ts` with new product IDs.

---

## Hard Usage Blockers

### Architecture: Server-Side Enforcement

**Every billable action goes through a usage gate before execution.** The gate is a middleware/utility function, not a frontend check.

```
User action → API endpoint → usageGate(userId, featureType) → proceed or 403
```

### Usage Gate Implementation

**New file:** `backend/src/middleware/usage-gate.ts`

```typescript
export async function checkUsageLimit(
  userId: string,
  featureType: FeatureType
): Promise<{ allowed: boolean; current: number; limit: number; resetAt: Date }> {
  // 1. Get user's subscription tier
  const tier = await getUserTier(userId);

  // 2. Get the limit for this feature type in this tier
  const limit = SUBSCRIPTION_TIERS[tier].limits[featureType];
  if (limit === Infinity) return { allowed: true, current: 0, limit: -1, resetAt: ... };

  // 3. Count usage in current billing period
  const periodStart = getCurrentBillingPeriodStart(userId);
  const currentUsage = await countFeatureUsage(userId, featureType, periodStart);

  // 4. Compare
  return {
    allowed: currentUsage < limit,
    current: currentUsage,
    limit,
    resetAt: getNextBillingPeriodStart(userId),
  };
}
```

### Where Gates Are Enforced

| Endpoint | Feature Type | Gate Location |
|----------|-------------|---------------|
| `POST /api/chat/sessions/:id/messages` | `generation` | Before `streamText()` call |
| `POST /api/reels/:id/analyze` | `analysis` | Before `callAi()` |
| `POST /api/audio/tts` | `tts` | Before OpenAI TTS call |
| `POST /api/video/generate` | `video_generation` | Before video job creation |
| `POST /api/projects` | `project` | Before DB insert |
| `POST /api/media/upload` | `video_upload` | Before R2 upload |

### Anti-Jailbreak Measures

**Layer 1: Server-side only**
All limits are enforced on the backend. The frontend shows usage counters and disabled buttons, but these are cosmetic — removing them doesn't bypass anything.

**Layer 2: Feature type recording**
Every billable action records a `featureUsage` row with `featureType`, `userId`, `createdAt`. The usage count is always derived from this table, not from a mutable counter.

```sql
-- Count is always computed, never stored as a mutable field
SELECT COUNT(*) FROM featureUsages
WHERE userId = $1
  AND featureType = $2
  AND createdAt >= $3  -- billing period start
```

**Layer 3: Rate limiting (already exists)**
The existing rate limiter prevents API abuse (60 req/min for customer endpoints). This prevents rapid-fire attempts to exhaust limits.

**Layer 4: Idempotency on generation**
Each chat message POST creates a `featureUsage` record atomically with the generation call. If the stream fails mid-response, the usage is still counted (the AI cost was incurred). The user can retry, which counts as a new usage.

**Layer 5: Prevent frontend-only bypass**
- Never trust `tier` or `usage` values sent from the frontend
- Always look up the user's tier from the database/Stripe
- The `GET /api/customer/usage` endpoint is for display only — the gate re-computes independently

**Layer 6: Webhook-synced tier**
Stripe webhook updates the user's tier in the database. If a subscription lapses or downgrades, the tier change is immediate. The usage gate reads from DB, not from a cached value.

### Frontend Usage Display

Show a usage bar on the Generate tab sidebar:

```
AI Generations    ████████░░  82/100
Reel Analyses     ███░░░░░░░  15/50
TTS Voiceovers    █░░░░░░░░░   3/20
Video Generation  ░░░░░░░░░░   0/5
Resets in 18 days
```

When a limit is reached:
- Disable the action button
- Show: "You've reached your monthly limit. Upgrade to [next tier] for more."
- Link to upgrade page

**Endpoint:** Enhance `GET /api/customer/usage` to return actual limits based on tier:
```json
{
  "tier": "creator",
  "usage": {
    "generation": { "current": 82, "limit": 100, "resetAt": "2026-04-01" },
    "analysis": { "current": 15, "limit": 50, "resetAt": "2026-04-01" },
    "tts": { "current": 3, "limit": 20, "resetAt": "2026-04-01" },
    "videoGeneration": { "current": 0, "limit": 5, "resetAt": "2026-04-01" }
  }
}
```

---

## AI Cost Tracking (Admin Portal)

### What to Track

For every AI API call, record:
- **Provider:** OpenAI, Anthropic, Stability, ElevenLabs
- **Model:** gpt-4o-mini, claude-haiku, tts-1, stable-diffusion, etc.
- **Feature:** generation, analysis, tts, video, image
- **Tokens:** Input tokens, output tokens (for LLMs)
- **Cost:** Calculated from token count × model pricing
- **User:** Who triggered it
- **Duration:** How long the API call took (latency tracking)

### Database

**New table:**

```sql
aiCostLedger
  id            serial PK
  userId        text NOT NULL
  provider      text NOT NULL       -- "openai", "anthropic", "stability"
  model         text NOT NULL       -- "gpt-4o-mini", "tts-1", etc.
  featureType   text NOT NULL       -- "generation", "analysis", "tts", "video"
  inputTokens   integer DEFAULT 0
  outputTokens  integer DEFAULT 0
  inputCost     numeric(10,6) DEFAULT 0   -- cost in USD
  outputCost    numeric(10,6) DEFAULT 0
  totalCost     numeric(10,6) DEFAULT 0
  durationMs    integer DEFAULT 0
  metadata      jsonb               -- additional context (sessionId, reelId, etc.)
  createdAt     timestamp DEFAULT now()
```

**Index:** `ai_cost_ledger_created_at_idx`, `ai_cost_ledger_user_id_idx`, `ai_cost_ledger_feature_type_idx`

### Cost Calculation

**Pricing table** (maintained as a constant, updated when providers change pricing):

```typescript
// backend/src/constants/ai-pricing.constants.ts
export const AI_PRICING = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },  // per token
  "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "claude-haiku-4-5": { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "tts-1": { perChar: 15.00 / 1_000_000 },  // $15 per 1M characters
  "tts-1-hd": { perChar: 30.00 / 1_000_000 },
  "dall-e-3": { perImage: 0.04 },  // 1024x1024
  "stable-diffusion": { perImage: 0.02 },
} as const;
```

### Recording Costs

**Modify `aiClient.ts`** to record costs after every call:

```typescript
// After generateText/streamText completes:
const usage = result.usage; // { promptTokens, completionTokens }
await recordAiCost({
  userId,
  provider: "openai",
  model: modelName,
  featureType,
  inputTokens: usage.promptTokens,
  outputTokens: usage.completionTokens,
  inputCost: usage.promptTokens * AI_PRICING[modelName].input,
  outputCost: usage.completionTokens * AI_PRICING[modelName].output,
  totalCost: inputCost + outputCost,
  durationMs: Date.now() - startTime,
});
```

The Vercel AI SDK's `generateText` and `streamText` both return `usage` with token counts.

### Admin Dashboard Endpoints

**New endpoints in `backend/src/routes/admin/index.ts`:**

```
GET /api/admin/ai-costs
  Query params:
    period: "day" | "week" | "month" | "all"
    groupBy: "provider" | "model" | "feature" | "user" | "day"
    startDate, endDate (optional)

  Response:
  {
    totalCost: 127.45,
    breakdown: [
      { group: "gpt-4o-mini", totalCost: 38.20, callCount: 45000, avgCostPerCall: 0.00085 },
      { group: "tts-1", totalCost: 15.00, callCount: 5000, avgCostPerCall: 0.003 },
      { group: "stable-diffusion", totalCost: 74.25, callCount: 3712, avgCostPerCall: 0.02 }
    ],
    trend: [
      { date: "2026-03-01", cost: 3.45 },
      { date: "2026-03-02", cost: 4.12 },
      ...
    ]
  }

GET /api/admin/ai-costs/by-user
  Response: top users by AI cost with per-feature breakdown

GET /api/admin/ai-costs/budget
  Response: current month spend vs budget alert thresholds
```

### Admin UI

Add a new section to the admin dashboard:

```
┌─────────────────────────────────────────────┐
│  AI Cost Dashboard                          │
│                                             │
│  This Month: $127.45  │  Daily Avg: $10.62  │
│  ════════════════════════════════            │
│                                             │
│  By Provider:          By Feature:          │
│  OpenAI    $53.20      Generation  $38.20   │
│  Anthropic $0.00       Analysis    $5.00    │
│  Stability $74.25      TTS         $15.00   │
│                        Video       $74.25   │
│                                             │
│  ┌─── Daily Trend ───────────────────┐      │
│  │    $15 ╭─╮                        │      │
│  │    $10 │ ╰─╮  ╭╮                  │      │
│  │     $5 │   ╰──╯╰─╮               │      │
│  │     $0 ┴─────────┴──────────     │      │
│  └───────────────────────────────────┘      │
│                                             │
│  Budget Alert: $500/month  [Edit]           │
│  Current: $127.45 (25.5%)                   │
│  ⚠ Projected: $318/month at current rate    │
└─────────────────────────────────────────────┘
```

### Budget Alerts

Store budget thresholds in env vars or a settings table:

```
AI_COST_BUDGET_MONTHLY=500       # USD
AI_COST_ALERT_THRESHOLD=0.8     # Alert at 80% of budget
```

When the monthly spend crosses the threshold, log a warning. Future: send email/Slack notification via existing Resend integration.

---

## Implementation Priority

```
P0 (MVP — Must Have Before Launch):
  - Usage gate middleware (server-side hard blocks)
  - Update subscription tiers to ContentAI features
  - Enhance GET /api/customer/usage to return real limits
  - Frontend usage display in Generate sidebar
  - "Limit reached" blocking UI

P1 (Cost Visibility):
  - aiCostLedger table + recording in aiClient.ts
  - AI pricing constants
  - GET /api/admin/ai-costs endpoint
  - Admin cost dashboard (basic table view)

P2 (Monitoring):
  - Daily trend chart
  - Budget alerts
  - Per-user cost breakdown
  - Projected monthly spend

P3 (Optimization):
  - Cost per feature analysis → identify expensive patterns
  - Auto-downgrade to cheaper models when budget is tight
  - Caching layer for repeated analyses (same reel analyzed by multiple users)
```

---

## Security Considerations

- **Never expose AI costs to non-admin users** — the cost endpoints are admin-only
- **Never expose the pricing constants** to the frontend — users shouldn't know per-call costs
- **Rate limit the usage endpoint** to prevent probing (`customer` tier: 60 req/min)
- **Billing period is server-authoritative** — computed from Stripe subscription dates, not client-sent
- **Free tier users** who try to access paid features get a 403 with upgrade prompt, not a silent failure
