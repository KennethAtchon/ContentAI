# AI Provider System — Domain Architecture

## Overview

ContentAI uses a registry-based AI provider system. All AI provider configuration — which providers are active, their API keys, and which models to use — is stored in the database and cached in Redis. This means providers and models can be switched in the admin panel without redeploying.

The system supports three providers: **OpenAI**, **Claude (Anthropic)**, and **OpenRouter**. Providers fall back to the next available one in priority order if a call fails or a key isn't configured.

---

## Architecture

```
backend/src/lib/
├── aiClient.ts              → Public API (callAi, getModel, getModelInfo, loadPrompt)
└── ai/
    ├── providers.ts         → Provider registry (definitions for all providers)
    ├── helpers.ts           → Provider resolution, token extraction, cost tracking
    └── config.ts            → DB-backed priority + enabled provider resolution

backend/src/services/config/
└── system-config.service.ts → DB+Redis config store (used by AI config)
```

---

## Provider Registry

All three providers are defined in `providers.ts` as a single `PROVIDER_REGISTRY` object:

```typescript
PROVIDER_REGISTRY = {
  openai:      { label, envApiKey, dbApiKeyName, dbModelKeys, defaultModels, createInstance },
  claude:      { label, envApiKey, dbApiKeyName, dbModelKeys, defaultModels, createInstance },
  openrouter:  { label, envApiKey, dbApiKeyName, dbModelKeys, defaultModels, createInstance },
}
```

**Adding a new provider = adding one entry to this object.** No other files change.

---

## Model Tiers

Every AI call specifies a `ModelTier`:

| Tier | Purpose | Default model |
|---|---|---|
| `"analysis"` | Cheap, fast — used for reel analysis and classification | `claude-haiku-4-5-20251001` |
| `"generation"` | Higher quality — used for content generation and chat | `claude-sonnet-4-6` |

Each provider has separate model names for each tier, all configurable via the admin panel.

---

## Key Resolution (Fallback Chain)

For each provider, the API key is resolved in this order:

1. **Database** (`system_config` table, `api_keys` category) — set via admin panel
2. **Environment variable** — fallback if no DB value exists

This means ENV vars work for local dev, but production keys can be rotated in the admin panel without a redeploy.

---

## Provider Priority & Fallback

The ordered list of providers to try is stored in `system_config` (category: `ai`, key: `provider_priority`). Default: `["openai", "claude", "openrouter"]`.

When a call is made:

1. `getEnabledProvidersAsync()` fetches the priority list from DB/cache, then filters to only providers that have a configured API key.
2. The first enabled provider is used.
3. If the provider fails mid-call, the error propagates (there is no mid-call retry to the next provider — fallback is at the configuration level, not per-request).

For non-streaming calls (`callAi`), the retry logic in `callAiWithFallback` does attempt the next provider if a call throws.

---

## DB-Backed Configuration (`SystemConfigService`)

Configuration is stored in the `system_config` table:

```typescript
{
  category: string,  // e.g., "ai", "api_keys"
  key: string,       // e.g., "provider_priority", "anthropic"
  value: jsonb,      // actual value
  isSecret: boolean, // if true, value is encrypted at rest
  isActive: boolean,
  updatedBy: string
}
```

**Redis caching:** All rows for a category are cached for **60 seconds**. After the TTL, the next read re-fetches from PostgreSQL. The admin panel has a "Invalidate Cache" button that clears all `sys_cfg:*` keys immediately.

**Secrets:** API keys are stored encrypted. `getAll()` redacts encrypted values so they're never sent over the wire.

---

## Prompt Loading

System prompts are stored as `.txt` files in `backend/src/prompts/`. They are loaded and cached in memory by `loadPrompt(name)`:

```typescript
const systemPrompt = loadPrompt("chat-generate");
// Reads from backend/src/prompts/chat-generate.txt
// Cached after first read — no disk I/O on subsequent calls
```

---

## Usage in Code

### Non-streaming calls (analysis, classification)

```typescript
import { callAi } from "@/lib/aiClient";

const { text, model, inputTokens, outputTokens } = await callAi({
  system: loadPrompt("reel-analysis"),
  userContent: analysisPrompt,
  maxTokens: 512,
  modelTier: "analysis",       // Uses cheaper model
  featureType: "reel_analysis",
  userId,
});
```

### Streaming calls (chat)

```typescript
import { getModel, getModelInfo } from "@/lib/aiClient";

const model = await getModel("generation");
const { providerId, model: modelName } = await getModelInfo("generation");

const result = await streamText({
  model,
  messages: [...],
  tools: createChatTools(ctx),
});
```

---

## Admin Configuration

Via `/admin/developer`, admins can:

- Set/rotate API keys for each provider (stored encrypted)
- Change analysis/generation model names per provider
- Reorder provider priority
- Invalidate the Redis config cache

Changes take effect within **~60 seconds** (Redis TTL). Force-invalidating the cache makes them immediate.

---

## Cost Tracking

After every AI call, `recordAiCost` is called asynchronously:

```typescript
await recordAiCost({
  userId,
  provider: "claude",
  model: "claude-sonnet-4-6",
  featureType: "generation",
  inputTokens: 450,
  outputTokens: 820,
  durationMs: 1200,
});
```

Costs are stored in the `ai_cost_ledger` table. The `costUsd` is estimated based on published token pricing per provider/model.

---

## Environment Variables

The following ENV vars serve as fallbacks when no DB value is configured:

| Variable | Provider | Tier |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude | — |
| `OPENAI_API_KEY` | OpenAI | — |
| `OPEN_ROUTER_KEY` | OpenRouter | — |
| `ANALYSIS_MODEL` | Claude | analysis |
| `GENERATION_MODEL` | Claude | generation |
| `OPENAI_MODEL` | OpenAI | both tiers |
| `OPEN_ROUTER_MODEL` | OpenRouter | both tiers |

---

## Related Documentation

- [Generation System](./generation-system.md) — Uses `callAi` for reel analysis + content generation
- [Chat Streaming System](./chat-streaming-system.md) — Uses `getModel` + `streamText`
- [Reel Generation System](./reel-generation-system.md) — Uses `callAi` for script parsing
- [Admin Dashboard](./admin-dashboard.md) — Admin UI for provider config

---

*Last updated: March 2026*
