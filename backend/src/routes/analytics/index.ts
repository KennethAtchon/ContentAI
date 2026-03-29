import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { rateLimiter } from "../../middleware/protection";
import { analyticsEventSchema } from "../../domain/analytics/analytics.schemas";
import { debugLog } from "../../utils/debug/debug";

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

// All analytics endpoints are fire-and-forget — they log metrics and return 200.
analytics.post(
  "/form-completion",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    const data = c.req.valid("json");
    debugLog.info("Analytics event", {
      service: "analytics",
      operation: "form-completion",
      data,
    });
    return c.json({ success: true });
  },
);
analytics.options("/form-completion", (c) => c.body(null, 200));

analytics.post(
  "/form-progress",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    const data = c.req.valid("json");
    debugLog.info("Analytics event", {
      service: "analytics",
      operation: "form-progress",
      data,
    });
    return c.json({ success: true });
  },
);
analytics.options("/form-progress", (c) => c.body(null, 200));

analytics.post(
  "/search-performance",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    const data = c.req.valid("json");
    debugLog.info("Analytics event", {
      service: "analytics",
      operation: "search-performance",
      data,
    });
    return c.json({ success: true });
  },
);
analytics.options("/search-performance", (c) => c.body(null, 200));

analytics.post(
  "/web-vitals",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, validationErrorHook),
  async (c) => {
    const data = c.req.valid("json");
    debugLog.info("Analytics event", {
      service: "analytics",
      operation: "web-vitals",
      data,
    });
    return c.json({ success: true });
  },
);
analytics.options("/web-vitals", (c) => c.body(null, 200));

export default analytics;
