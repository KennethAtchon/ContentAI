import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { rateLimiter } from "../../middleware/protection";
import { analyticsEventSchema } from "../../domain/analytics/analytics.schemas";

const analytics = new Hono();

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

// Fire-and-forget: validate body shape, acknowledge. (Wire to metrics backend when needed.)
analytics.post(
  "/form-completion",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/form-completion", (c) => c.body(null, 200));

analytics.post(
  "/form-progress",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/form-progress", (c) => c.body(null, 200));

analytics.post(
  "/search-performance",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/search-performance", (c) => c.body(null, 200));

analytics.post(
  "/web-vitals",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/web-vitals", (c) => c.body(null, 200));

export default analytics;
