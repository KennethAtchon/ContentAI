## AI Provider System

This document explains how the AI provider configuration works — why it's stored in the database, how the fallback chain works, and what "model tiers" mean.

---

## The Core Idea: Config in the Database, Not Hard-Coded

Most apps hard-code AI provider settings in environment variables — one provider, one model, baked in at deploy time. This system does it differently: provider priority, which providers are active, their API keys, and which models to use are all stored in the database, cached in Redis, and editable through the admin panel.

The practical effect: you can switch from Claude to OpenAI, rotate API keys, or change which model gets used for analysis — without touching code or redeploying. Changes propagate within ~60 seconds (the Redis cache TTL). There's a "Invalidate Cache" button in the admin panel if you need changes to take effect immediately.

---

## The Three Providers

Three providers are supported: OpenAI, Claude (Anthropic), and OpenRouter. OpenRouter is a meta-provider that routes to many models (including Claude, GPT-4, etc.) through a single API — useful if you want access to many models without managing multiple API keys.

All three are configured the same way: an entry in the provider registry defines how to instantiate the SDK client and where to find the API key. Adding a new provider means adding one entry to that registry object — nothing else changes.

---

## Model Tiers: Analysis vs Generation

Every AI call specifies a tier — either `"analysis"` or `"generation"`. These map to different models:

**Analysis** — used for reel analysis and classification. Cheap, fast model (defaults to Claude Haiku). The task is mechanical: classify a reel's patterns from a fixed taxonomy and return JSON. No creativity required, so a cheaper model is appropriate.

**Generation** — used for content creation and chat. Higher-quality model (defaults to Claude Sonnet). The task is creative writing where quality directly affects what users see and use.

Each provider has separate model names configured for each tier. So "use Sonnet for generation and Haiku for analysis" is the default, but an admin could switch generation to GPT-4o while keeping analysis on Haiku — without touching any code.

---

## How the Fallback Chain Works

When code calls the AI, it asks for an `"analysis"` or `"generation"` tier model. The system:

1. Fetches the provider priority list from the database (cached in Redis). Default order: OpenAI → Claude → OpenRouter.
2. Filters to only providers that have a configured API key (either in the DB or as an env var).
3. Uses the first provider with a key.

**For non-streaming calls** (`callAi`): if the first provider throws an error, the system retries with the next provider in the list. This is a true runtime fallback.

**For streaming calls** (`getModel`): there's no mid-call retry. The selected model is returned and used; if it fails during streaming, the error surfaces to the caller. The fallback here is at configuration time — you configure a working provider as primary.

---

## How API Keys Are Resolved

For each provider, the API key is found in this order:
1. Check the database `system_config` table (category: `api_keys`)
2. Fall back to the environment variable (e.g., `ANTHROPIC_API_KEY`)

This means env vars still work for local development — just set them normally. In production, keys can be rotated through the admin panel without touching env vars or redeploying. DB values take precedence over env vars.

Keys stored in the database are encrypted at rest. The admin API redacts them when listing configs — you can update a key but not read it back.

---

## The Redis Cache

All config reads go through Redis. The first read after a cache miss queries PostgreSQL and stores the result in Redis with a 60-second TTL. Subsequent reads within that window hit Redis only.

This means the DB isn't queried on every AI call. The overhead of a config lookup is a fast Redis read.

When an admin updates config through the panel, the new value is written to the DB. The Redis cache will expire within 60 seconds and pick up the new value. The "Invalidate Cache" button clears all cached config keys immediately, forcing the next reads to go to the DB.

---

## System Prompts

Prompts for different AI tasks (chat generation, reel analysis) are `.txt` files on disk in `backend/src/prompts/`. They're read from disk on first use and cached in memory for the lifetime of the process — no disk I/O after the first call. To change a prompt, you update the file and restart the server.

---

## User-level overrides

Admins edit **global** provider priority, models, and keys. Individual users can store **personal defaults** (preferred AI provider, video provider, voice, TTS speed, aspect ratio) via **`/api/customer/settings`**. Resolution logic in feature code typically applies user prefs when set, otherwise falls back to system config.

See [User Preferences System](./user-preferences-system.md).
