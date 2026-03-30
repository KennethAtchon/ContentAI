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
import { updateCustomerSettingsSchema } from "../../domain/customer/customer.schemas";
import {
  buildCustomerAiDefaultsResponse,
  buildCustomerVideoDefaultsResponse,
} from "../../domain/customer/customer-settings-defaults";

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

userSettingsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const userId = auth.user.id;
    const settings = await userSettingsService.get(userId);
    return c.json(settings ?? { userId });
  },
);

userSettingsRouter.put(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", updateCustomerSettingsSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const userId = auth.user.id;
    const parsed = c.req.valid("json");

    const input = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [
        k,
        v === "system_default" ? null : v,
      ]),
    );

    const settings = await userSettingsService.upsert(userId, input);
    return c.json(settings);
  },
);

userSettingsRouter.get(
  "/ai-defaults",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const body = await buildCustomerAiDefaultsResponse();
    return c.json(body);
  },
);

userSettingsRouter.get(
  "/video-defaults",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const body = await buildCustomerVideoDefaultsResponse(systemConfigService);
    return c.json(body);
  },
);

userSettingsRouter.delete(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    await userSettingsService.reset(auth.user.id);
    return c.json({ success: true });
  },
);

export default userSettingsRouter;
