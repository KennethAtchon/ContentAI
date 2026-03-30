import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { systemConfigService } from "../../domain/singletons";
import {
  adminConfigInvalidateBodySchema,
  adminConfigUpdateBodySchema,
  adminConfigCategoryParamSchema,
  adminConfigKeyParamSchema,
} from "../../domain/admin/admin.schemas";

const configAdminRouter = new Hono<HonoEnv>();
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

// ─── GET /api/admin/config ────────────────────────────────────────────────────

configAdminRouter.get(
  "/config",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const rows = await systemConfigService.getAll();
    return c.json({ config: rows });
  },
);

// ─── GET /api/admin/config/:category ─────────────────────────────────────────

configAdminRouter.get(
  "/config/:category",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminConfigCategoryParamSchema, validationErrorHook),
  async (c) => {
    const { category } = c.req.valid("param");
    const rows = await systemConfigService.getCategoryPublic(category);
    return c.json(rows);
  },
);

// ─── PUT /api/admin/config/:category/:key ─────────────────────────────────────

configAdminRouter.put(
  "/config/:category/:key",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminConfigKeyParamSchema, validationErrorHook),
  zValidator("json", adminConfigUpdateBodySchema, validationErrorHook),
  async (c) => {
    const { category, key } = c.req.valid("param");
    const parsed = c.req.valid("json");

    const auth = c.get("auth");
    await systemConfigService.set(
      category,
      key,
      parsed.value,
      auth.user.email,
    );

    return c.json({ success: true });
  },
);

// ─── GET /api/admin/config/ai-providers/status ────────────────────────────────

configAdminRouter.get(
  "/config/ai-providers/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const {
      getEnabledProvidersAsync,
      getProviderPriorityAsync,
      getModelForProviderAsync,
    } = await import("../../lib/ai/config");
    const { PROVIDER_REGISTRY } = await import("../../lib/ai/providers");

    const [priority, enabled] = await Promise.all([
      getProviderPriorityAsync(),
      getEnabledProvidersAsync(),
    ]);

    const enabledSet = new Set(enabled);

    const providers = await Promise.all(
      priority.map(async (id) => {
        const def = PROVIDER_REGISTRY[id];
        const active = enabledSet.has(id);
        const [analysisModel, generationModel] = active
          ? await Promise.all([
              getModelForProviderAsync(id, "analysis"),
              getModelForProviderAsync(id, "generation"),
            ])
          : [def.defaultModels.analysis, def.defaultModels.generation];

        return {
          id,
          label: def.label,
          active,
          analysisModel,
          generationModel,
        };
      }),
    );

    return c.json({
      providers,
      defaultProvider: enabled[0] ?? null,
    });
  },
);

// ─── GET /api/admin/config/video-providers/status ─────────────────────────────

configAdminRouter.get(
  "/config/video-providers/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const { klingFalProvider } =
      await import("../../services/video-generation/providers/kling-fal");
    const { runwayProvider } =
      await import("../../services/video-generation/providers/runway");
    const { imageKenBurnsProvider } =
      await import("../../services/video-generation/providers/image-ken-burns");
    const { systemConfigService: cfg } =
      await import("../../domain/singletons");

    const ALL_VIDEO_PROVIDERS = [
      {
        id: "kling-fal",
        label: "Kling (via Fal.ai)",
        provider: klingFalProvider,
        modelKey: "kling_model",
        defaultModel: "fal-ai/kling-video/v2.1/standard/text-to-video",
      },
      {
        id: "runway",
        label: "Runway",
        provider: runwayProvider,
        modelKey: "runway_model",
        defaultModel: "gen3a_turbo",
      },
      {
        id: "image-ken-burns",
        label: "Image + Ken Burns",
        provider: imageKenBurnsProvider,
        modelKey: "flux_model",
        defaultModel: "fal-ai/flux/schnell",
      },
    ] as const;

    const [availabilities, dbDefault, dbFallback] = await Promise.all([
      Promise.all(ALL_VIDEO_PROVIDERS.map((p) => p.provider.isAvailable())),
      cfg.get("video", "default_provider"),
      cfg.getJson<string[]>("video", "fallback_order", [
        "kling-fal",
        "image-ken-burns",
        "runway",
      ]),
    ]);

    const providers = await Promise.all(
      ALL_VIDEO_PROVIDERS.map(async (p, i) => {
        const active = availabilities[i] ?? false;
        const model = await cfg
          .get("video", p.modelKey)
          .then((v) => v || p.defaultModel);
        return { id: p.id, label: p.label, active, model };
      }),
    );

    const defaultProvider = dbDefault ?? "kling-fal";
    const activeDefault =
      providers.find((p) => p.id === defaultProvider && p.active) ??
      providers.find((p) => dbFallback.includes(p.id) && p.active) ??
      null;

    return c.json({
      providers,
      defaultProvider: activeDefault?.id ?? null,
      configuredDefault: defaultProvider,
    });
  },
);

// ─── GET /api/admin/config/api-keys/status ────────────────────────────────────

configAdminRouter.get(
  "/config/api-keys/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const {
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
    } = await import("../../utils/config/envUtil");

    const keyEnvMap: Record<string, string> = {
      anthropic_api_key: ANTHROPIC_API_KEY,
      openai_api_key: OPENAI_API_KEY,
      openrouter_api_key: OPEN_ROUTER_KEY,
      fal_api_key: FAL_API_KEY,
      runway_api_key: RUNWAY_API_KEY,
      elevenlabs_api_key: ELEVENLABS_API_KEY,
      resend_api_key: RESEND_API_KEY,
      stripe_secret_key: STRIPE_SECRET_KEY,
      stripe_webhook_secret: STRIPE_WEBHOOK_SECRET,
      instagram_api_token: INSTAGRAM_API_TOKEN,
      social_api_key: SOCIAL_API_KEY,
    };

    const results = await Promise.all(
      Object.entries(keyEnvMap).map(async ([key, envVal]) => {
        const active = await systemConfigService.hasApiKey(key, envVal);
        const source = await systemConfigService
          .get("api_keys", key)
          .then((v) => (v && v.trim() ? "db" : envVal ? "env" : "none"))
          .catch(() => (envVal ? "env" : "none"));
        return [key, { active, source }] as const;
      }),
    );

    return c.json({ keys: Object.fromEntries(results) });
  },
);

// ─── POST /api/admin/config/cache/invalidate ──────────────────────────────────

configAdminRouter.post(
  "/config/cache/invalidate",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminConfigInvalidateBodySchema, validationErrorHook),
  async (c) => {
    const { category } = c.req.valid("json");
    await systemConfigService.invalidateCache(category);
    return c.json({ success: true, invalidated: category });
  },
);

export default configAdminRouter;
