import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { userSettingsService } from "../../services/config/user-settings.service";
import { debugLog } from "../../utils/debug/debug";

const userSettingsRouter = new Hono<HonoEnv>();

const updateSchema = z.object({
  preferredAiProvider: z
    .enum(["openai", "claude", "openrouter"])
    .nullable()
    .optional(),
  preferredVideoProvider: z
    .enum(["kling-fal", "runway", "image-ken-burns"])
    .nullable()
    .optional(),
  preferredVoiceId: z.string().max(100).nullable().optional(),
  preferredTtsSpeed: z.enum(["slow", "normal", "fast"]).nullable().optional(),
  preferredAspectRatio: z.enum(["9:16", "16:9", "1:1"]).nullable().optional(),
});

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
  async (c) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;
      const body = await c.req.json();
      const parsed = updateSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { error: "Invalid request body", issues: parsed.error.issues },
          400,
        );
      }

      // Map system_default sentinel values back to null
      const input = Object.fromEntries(
        Object.entries(parsed.data).map(([k, v]) => [
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
        return c.json({ defaultProvider: null, defaultProviderLabel: null, analysisModel: null, generationModel: null });
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
      const { klingFalProvider } = await import("../../services/media/video-generation/providers/kling-fal");
      const { runwayProvider } = await import("../../services/media/video-generation/providers/runway");
      const { imageKenBurnsProvider } = await import("../../services/media/video-generation/providers/image-ken-burns");
      const { systemConfigService } = await import("../../services/config/system-config.service");

      const PROVIDERS = [
        { id: "kling-fal", label: "Kling (via Fal.ai)", provider: klingFalProvider },
        { id: "runway", label: "Runway", provider: runwayProvider },
        { id: "image-ken-burns", label: "Image + Ken Burns", provider: imageKenBurnsProvider },
      ] as const;

      const [dbDefault, availabilities] = await Promise.all([
        systemConfigService.get("video", "default_provider"),
        Promise.all(PROVIDERS.map((p) => p.provider.isAvailable())),
      ]);

      const configuredDefault = dbDefault ?? "kling-fal";
      const preferred = PROVIDERS.find((p) => p.id === configuredDefault);
      const preferredActive = preferred && availabilities[PROVIDERS.indexOf(preferred)];

      const effectiveDefault = preferredActive
        ? preferred
        : PROVIDERS.find((_, i) => availabilities[i]) ?? null;

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
