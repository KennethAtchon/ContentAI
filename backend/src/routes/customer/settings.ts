import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import {
  systemConfigService,
  userSettingsService,
} from "../../domain/singletons";
import { debugLog } from "../../utils/debug/debug";
import { updateCustomerSettingsSchema } from "../../domain/customer/customer.schemas";

const userSettingsRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

// ─── GET /api/customer/settings ───────────────────────────────────────────────

userSettingsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;
      const settings = await userSettingsService.get(userId);
      return c.json(settings ?? { userId });
    } catch (error) {
      debugLog.error("Failed to fetch user settings", {
        service: "user-settings",
        operation: "get",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to fetch settings" }, 500);
    }
  },
);

// ─── PUT /api/customer/settings ───────────────────────────────────────────────

userSettingsRouter.put(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", updateCustomerSettingsSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;
      const parsed = c.req.valid("json");

      // Map system_default sentinel values back to null
      const input = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [
          k,
          v === "system_default" ? null : v,
        ]),
      );

      const settings = await userSettingsService.upsert(userId, input);
      return c.json(settings);
    } catch (error) {
      debugLog.error("Failed to update user settings", {
        service: "user-settings",
        operation: "upsert",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to update settings" }, 500);
    }
  },
);

// ─── GET /api/customer/settings/ai-defaults ───────────────────────────────────

/**
 * Returns whether a given provider + model combination supports vision
 * (image/multimodal input). Based on known model naming conventions.
 */
function detectSupportsVision(provider: string, model: string): boolean {
  const m = model.toLowerCase();

  if (provider === "claude") {
    // claude-3-*, claude-3.5-*, claude-*-4-* all support vision; claude-2.* does not
    return (
      m.startsWith("claude-3") ||
      m.includes("-4-") ||
      m.includes("-sonnet-4") ||
      m.includes("-opus-4") ||
      m.includes("-haiku-4")
    );
  }

  if (provider === "openai") {
    return (
      m.startsWith("gpt-4o") ||
      m.includes("gpt-4-vision") ||
      m.includes("gpt-4-turbo") ||
      m.startsWith("o1") ||
      m.startsWith("o3") ||
      m.startsWith("o4")
    );
  }

  if (provider === "openrouter") {
    // Match by model path prefix (openrouter format: "provider/model-name")
    return (
      m.startsWith("anthropic/claude-3") ||
      (m.startsWith("anthropic/claude-") &&
        (m.includes("-4-") ||
          m.includes("sonnet-4") ||
          m.includes("opus-4"))) ||
      m.startsWith("openai/gpt-4o") ||
      m.startsWith("openai/o1") ||
      m.startsWith("openai/o3") ||
      m.startsWith("google/gemini") ||
      (m.startsWith("meta-llama/llama-3") && m.includes("vision")) ||
      m.startsWith("mistralai/pixtral") ||
      m.startsWith("qwen/qwen-vl") ||
      (m.startsWith("x-ai/grok") && !m.includes("mini"))
    );
  }

  return false;
}

/**
 * Returns approximate context window in tokens for display purposes.
 * Returns null if unknown.
 */
function detectContextWindow(provider: string, model: string): number | null {
  const m = model.toLowerCase();

  if (provider === "claude") {
    if (
      m.startsWith("claude-3") ||
      (m.includes("claude-") && m.includes("-4-"))
    )
      return 200_000;
    return null;
  }

  if (provider === "openai") {
    if (
      m.startsWith("gpt-4o") ||
      m.startsWith("gpt-4-turbo") ||
      m.startsWith("o1") ||
      m.startsWith("o3") ||
      m.startsWith("o4")
    )
      return 128_000;
    if (m.startsWith("gpt-4")) return 8_192;
    if (m.startsWith("gpt-3.5-turbo-16k")) return 16_384;
    if (m.startsWith("gpt-3.5")) return 4_096;
    return null;
  }

  if (provider === "openrouter") {
    if (m.startsWith("anthropic/claude")) return 200_000;
    if (m.startsWith("google/gemini-1.5") || m.startsWith("google/gemini-2"))
      return 1_000_000;
    if (m.startsWith("openai/gpt-4o") || m.startsWith("openai/o1"))
      return 128_000;
    if (m.includes("deepseek")) return 128_000;
    if (m.includes("llama-3")) return 128_000;
    return null;
  }

  return null;
}

userSettingsRouter.get(
  "/ai-defaults",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const { getEnabledProvidersAsync, getModelForProviderAsync } =
        await import("../../lib/ai/config");
      const { PROVIDER_REGISTRY } = await import("../../lib/ai/providers");

      const enabled = await getEnabledProvidersAsync();
      const defaultProvider = enabled[0] ?? null;

      if (!defaultProvider) {
        return c.json({
          defaultProvider: null,
          defaultProviderLabel: null,
          analysisModel: null,
          generationModel: null,
          supportsVision: false,
          contextWindow: null,
        });
      }

      const def = PROVIDER_REGISTRY[defaultProvider];
      const [analysisModel, generationModel] = await Promise.all([
        getModelForProviderAsync(defaultProvider, "analysis"),
        getModelForProviderAsync(defaultProvider, "generation"),
      ]);

      return c.json({
        defaultProvider,
        defaultProviderLabel: def.label,
        analysisModel,
        generationModel,
        supportsVision: detectSupportsVision(defaultProvider, generationModel),
        contextWindow: detectContextWindow(defaultProvider, generationModel),
      });
    } catch (error) {
      debugLog.error("Failed to fetch AI defaults", {
        service: "user-settings",
        operation: "getAiDefaults",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to fetch AI defaults" }, 500);
    }
  },
);

// ─── GET /api/customer/settings/video-defaults ────────────────────────────────

userSettingsRouter.get(
  "/video-defaults",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const { klingFalProvider } =
        await import("../../services/video-generation/providers/kling-fal");
      const { runwayProvider } =
        await import("../../services/video-generation/providers/runway");
      const { imageKenBurnsProvider } =
        await import("../../services/video-generation/providers/image-ken-burns");

      const PROVIDERS = [
        {
          id: "kling-fal",
          label: "Kling (via Fal.ai)",
          provider: klingFalProvider,
        },
        { id: "runway", label: "Runway", provider: runwayProvider },
        {
          id: "image-ken-burns",
          label: "Image + Ken Burns",
          provider: imageKenBurnsProvider,
        },
      ] as const;

      const [dbDefault, availabilities] = await Promise.all([
        systemConfigService.get("video", "default_provider"),
        Promise.all(PROVIDERS.map((p) => p.provider.isAvailable())),
      ]);

      const configuredDefault = dbDefault ?? "kling-fal";
      const preferred = PROVIDERS.find((p) => p.id === configuredDefault);
      const preferredActive =
        preferred && availabilities[PROVIDERS.indexOf(preferred)];

      const effectiveDefault = preferredActive
        ? preferred
        : (PROVIDERS.find((_, i) => availabilities[i]) ?? null);

      return c.json({
        defaultProvider: effectiveDefault?.id ?? null,
        defaultProviderLabel: effectiveDefault?.label ?? null,
      });
    } catch (error) {
      debugLog.error("Failed to fetch video defaults", {
        service: "user-settings",
        operation: "getVideoDefaults",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to fetch video defaults" }, 500);
    }
  },
);

// ─── DELETE /api/customer/settings ────────────────────────────────────────────

userSettingsRouter.delete(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      await userSettingsService.reset(auth.user.id);
      return c.json({ success: true });
    } catch (error) {
      debugLog.error("Failed to reset user settings", {
        service: "user-settings",
        operation: "reset",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to reset settings" }, 500);
    }
  },
);

export default userSettingsRouter;
