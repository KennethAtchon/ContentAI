import { Hono } from "hono";
import { rateLimiter } from "../../middleware/protection";
import { debugLog } from "../../utils/debug/debug";

const analytics = new Hono();

// All analytics endpoints are fire-and-forget — they log metrics and return 200.

analytics.post("/form-completion", rateLimiter("public"), async (c) => {
  try {
    const data = await c.req.json();
    debugLog.info("Form completion event", {
      service: "analytics",
      operation: "form-completion",
      data,
    });
    return c.json({ success: true });
  } catch {
    return c.json({ success: false }, 500);
  }
});

analytics.options("/form-completion", (c) => c.body(null, 200));

analytics.post("/form-progress", rateLimiter("public"), async (c) => {
  try {
    const data = await c.req.json();
    debugLog.info("Form progress event", {
      service: "analytics",
      operation: "form-progress",
      data,
    });
    return c.json({ success: true });
  } catch {
    return c.json({ success: false }, 500);
  }
});

analytics.options("/form-progress", (c) => c.body(null, 200));

analytics.post("/search-performance", rateLimiter("public"), async (c) => {
  try {
    const data = await c.req.json();
    debugLog.info("Search performance event", {
      service: "analytics",
      operation: "search-performance",
      data,
    });
    return c.json({ success: true });
  } catch {
    return c.json({ success: false }, 500);
  }
});

analytics.options("/search-performance", (c) => c.body(null, 200));

analytics.post("/web-vitals", rateLimiter("public"), async (c) => {
  try {
    const data = await c.req.json();
    debugLog.info("Web vitals event", {
      service: "analytics",
      operation: "web-vitals",
      data,
    });
    return c.json({ success: true });
  } catch {
    return c.json({ success: false }, 500);
  }
});

analytics.options("/web-vitals", (c) => c.body(null, 200));

export default analytics;
