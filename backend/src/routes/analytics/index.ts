import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import { rateLimiter } from "../../middleware/protection";
import { analyticsEventSchema } from "../../domain/analytics/analytics.schemas";

const analytics = new Hono();


// Fire-and-forget: validate body shape, acknowledge. (Wire to metrics backend when needed.)
analytics.post(
  "/form-completion",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, zodValidationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/form-completion", (c) => c.body(null, 200));

analytics.post(
  "/form-progress",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, zodValidationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/form-progress", (c) => c.body(null, 200));

analytics.post(
  "/search-performance",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, zodValidationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/search-performance", (c) => c.body(null, 200));

analytics.post(
  "/web-vitals",
  rateLimiter("public"),
  zValidator("json", analyticsEventSchema, zodValidationErrorHook),
  async (c) => {
    c.req.valid("json");
    return c.json({ success: true });
  },
);
analytics.options("/web-vitals", (c) => c.body(null, 200));

export default analytics;
