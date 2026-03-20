/**
 * Seeds default system config values.
 * Uses ON CONFLICT DO NOTHING — safe to call on every startup.
 * ENV values are used as initial defaults so nothing breaks after first deploy.
 */

import { db } from "@/services/db/db";
import { systemConfig } from "@/infrastructure/database/drizzle/schema";
import { encrypt } from "@/utils/crypto/encryption";
import { debugLog } from "@/utils/debug/debug";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPEN_ROUTER_KEY,
  FAL_API_KEY,
  RUNWAY_API_KEY,
  ELEVENLABS_API_KEY,
  RESEND_API_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  INSTAGRAM_API_TOKEN,
  SOCIAL_API_KEY,
  ANALYSIS_MODEL,
  GENERATION_MODEL,
  OPENAI_MODEL,
  OPEN_ROUTER_MODEL,
  VIDEO_GENERATION_PROVIDER,
  RUNWAY_MODEL,
  KLING_MODEL,
  FLUX_MODEL,
} from "@/utils/config/envUtil";
import { VOICES } from "@/config/voices";

interface SeedEntry {
  category: string;
  key: string;
  value: string | null;
  encryptedValue?: string | null;
  valueType: "string" | "number" | "boolean" | "json";
  isSecret?: boolean;
  description?: string;
}

function secretEntry(
  category: string,
  key: string,
  envValue: string,
  description: string,
): SeedEntry {
  return {
    category,
    key,
    value: null,
    encryptedValue: envValue ? encrypt(envValue) : null,
    valueType: "string",
    isSecret: true,
    description,
  };
}

function buildSeedEntries(): SeedEntry[] {
  return [
    // ── AI ─────────────────────────────────────────────────────────────────────
    {
      category: "ai",
      key: "provider_priority",
      value: JSON.stringify(["openai", "claude", "openrouter"]),
      valueType: "json",
      description: "Ordered list of AI providers to try. First available is used.",
    },
    {
      category: "ai",
      key: "claude_analysis_model",
      value: ANALYSIS_MODEL,
      valueType: "string",
      description: "Claude model for fast/cheap analysis tasks",
    },
    {
      category: "ai",
      key: "claude_generation_model",
      value: GENERATION_MODEL,
      valueType: "string",
      description: "Claude model for high-quality generation tasks",
    },
    {
      category: "ai",
      key: "openai_model",
      value: OPENAI_MODEL,
      valueType: "string",
      description: "OpenAI model for analysis and generation",
    },
    {
      category: "ai",
      key: "openrouter_model",
      value: OPEN_ROUTER_MODEL,
      valueType: "string",
      description: "OpenRouter model endpoint",
    },
    {
      category: "ai",
      key: "max_tokens",
      value: "1024",
      valueType: "number",
      description: "Default max tokens for AI completions",
    },

    // ── Video ──────────────────────────────────────────────────────────────────
    {
      category: "video",
      key: "default_provider",
      value: VIDEO_GENERATION_PROVIDER || "kling-fal",
      valueType: "string",
      description: "Default video generation provider",
    },
    {
      category: "video",
      key: "fallback_order",
      value: JSON.stringify(["kling-fal", "image-ken-burns", "runway"]),
      valueType: "json",
      description: "Provider fallback order when default is unavailable",
    },
    {
      category: "video",
      key: "shot_min_duration_seconds",
      value: "3",
      valueType: "number",
      description: "Minimum duration per shot in seconds",
    },
    {
      category: "video",
      key: "shot_max_duration_seconds",
      value: "10",
      valueType: "number",
      description: "Maximum duration per shot in seconds",
    },
    {
      category: "video",
      key: "timeline_max_duration_ms",
      value: "180000",
      valueType: "number",
      description: "Maximum total timeline duration in milliseconds",
    },
    {
      category: "video",
      key: "clip_pacing_min_ms",
      value: "800",
      valueType: "number",
      description: "Minimum recommended clip pacing in milliseconds",
    },
    {
      category: "video",
      key: "clip_pacing_max_ms",
      value: "12000",
      valueType: "number",
      description: "Maximum recommended clip pacing in milliseconds",
    },
    {
      category: "video",
      key: "runway_model",
      value: RUNWAY_MODEL || "gen3a_turbo",
      valueType: "string",
      description: "Runway model: gen3a_turbo or gen3a",
    },
    {
      category: "video",
      key: "kling_model",
      value: KLING_MODEL || "fal-ai/kling-video/v2.1/standard/text-to-video",
      valueType: "string",
      description: "Kling model endpoint on fal.ai",
    },
    {
      category: "video",
      key: "flux_model",
      value: FLUX_MODEL || "fal-ai/flux/schnell",
      valueType: "string",
      description: "FLUX model for image+ken-burns provider",
    },

    // ── Subscription ───────────────────────────────────────────────────────────
    {
      category: "subscription",
      key: "trial_days",
      value: "14",
      valueType: "number",
      description: "Number of free trial days",
    },
    {
      category: "subscription",
      key: "free_generations_per_month",
      value: "10",
      valueType: "number",
      description: "Max AI generations per month for free tier",
    },
    {
      category: "subscription",
      key: "free_analyses_per_month",
      value: "5",
      valueType: "number",
      description: "Max reel analyses per month for free tier",
    },
    {
      category: "subscription",
      key: "basic_max_reels_per_month",
      value: "100",
      valueType: "number",
      description: "Max reels per month for Creator tier",
    },
    {
      category: "subscription",
      key: "basic_generations_per_month",
      value: "100",
      valueType: "number",
      description: "Max AI generations per month for Creator tier",
    },
    {
      category: "subscription",
      key: "basic_analyses_per_month",
      value: "50",
      valueType: "number",
      description: "Max reel analyses per month for Creator tier",
    },
    {
      category: "subscription",
      key: "basic_max_queue_items",
      value: "10",
      valueType: "number",
      description: "Max queue items for Creator tier",
    },
    {
      category: "subscription",
      key: "pro_generations_per_month",
      value: "500",
      valueType: "number",
      description: "Max AI generations per month for Pro tier",
    },
    {
      category: "subscription",
      key: "pro_analyses_per_month",
      value: "200",
      valueType: "number",
      description: "Max reel analyses per month for Pro tier",
    },
    {
      category: "subscription",
      key: "pro_max_queue_items",
      value: "100",
      valueType: "number",
      description: "Max queue items for Pro tier",
    },

    // ── Feature Flags ──────────────────────────────────────────────────────────
    {
      category: "feature_flags",
      key: "cron_jobs_enabled",
      value: "true",
      valueType: "boolean",
      description: "Enable background scheduled jobs",
    },
    {
      category: "feature_flags",
      key: "metrics_enabled",
      value: "true",
      valueType: "boolean",
      description: "Expose Prometheus /metrics endpoint",
    },
    {
      category: "feature_flags",
      key: "debug_enabled",
      value: "false",
      valueType: "boolean",
      description: "Enable verbose debug logging",
    },
    {
      category: "feature_flags",
      key: "mock_reel_scrape",
      value: "false",
      valueType: "boolean",
      description: "Return mock data instead of calling Instagram API",
    },
    {
      category: "feature_flags",
      key: "db_health_checks_enabled",
      value: "false",
      valueType: "boolean",
      description: "Run periodic database health checks",
    },

    // ── Content ────────────────────────────────────────────────────────────────
    {
      category: "content",
      key: "viral_views_threshold",
      value: "100000",
      valueType: "number",
      description: "Minimum view count to classify a reel as viral",
    },

    // ── TTS ────────────────────────────────────────────────────────────────────
    {
      category: "tts",
      key: "cost_per_1000_chars",
      value: "0.30",
      valueType: "number",
      description: "ElevenLabs TTS cost per 1,000 characters (USD)",
    },
    {
      category: "tts",
      key: "voices",
      value: JSON.stringify(VOICES),
      valueType: "json",
      description: "Available TTS voices with ElevenLabs mappings",
    },

    // ── API Keys (secrets) ─────────────────────────────────────────────────────
    secretEntry("api_keys", "anthropic_api_key", ANTHROPIC_API_KEY, "Anthropic Claude API key"),
    secretEntry("api_keys", "openai_api_key", OPENAI_API_KEY, "OpenAI API key"),
    secretEntry("api_keys", "openrouter_api_key", OPEN_ROUTER_KEY, "OpenRouter API key"),
    secretEntry("api_keys", "fal_api_key", FAL_API_KEY, "Fal.ai API key (Kling + FLUX)"),
    secretEntry("api_keys", "runway_api_key", RUNWAY_API_KEY, "Runway ML API key"),
    secretEntry("api_keys", "elevenlabs_api_key", ELEVENLABS_API_KEY, "ElevenLabs TTS API key"),
    secretEntry("api_keys", "resend_api_key", RESEND_API_KEY, "Resend email API key"),
    secretEntry("api_keys", "stripe_secret_key", STRIPE_SECRET_KEY, "Stripe secret key"),
    secretEntry("api_keys", "stripe_webhook_secret", STRIPE_WEBHOOK_SECRET, "Stripe webhook signing secret"),
    secretEntry("api_keys", "instagram_api_token", INSTAGRAM_API_TOKEN, "Instagram scraping API token"),
    secretEntry("api_keys", "social_api_key", SOCIAL_API_KEY, "Social media API key"),
  ];
}

export async function seedSystemConfig(): Promise<void> {
  try {
    const entries = buildSeedEntries();

    for (const entry of entries) {
      await db
        .insert(systemConfig)
        .values({
          category: entry.category,
          key: entry.key,
          value: entry.value ?? null,
          encryptedValue: entry.encryptedValue ?? null,
          valueType: entry.valueType,
          isSecret: entry.isSecret ?? false,
          description: entry.description ?? null,
        })
        .onConflictDoNothing();
    }

    debugLog.info(`System config seeded (${entries.length} entries)`, {
      service: "config-seed",
      operation: "seed",
    });
  } catch (error) {
    debugLog.error("Failed to seed system config", {
      service: "config-seed",
      operation: "seed",
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-fatal — server should still start
  }
}
