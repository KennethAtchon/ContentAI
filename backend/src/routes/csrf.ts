import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../middleware/protection";
import type { HonoEnv } from "../middleware/protection";
import { generateCSRFToken } from "../services/csrf/csrf-protection";
import { debugLog } from "../utils/debug/debug";

const app = new Hono<HonoEnv>();

/**
 * GET /api/csrf
 * Returns a CSRF token for the authenticated user.
 * Used by authenticated-fetch.ts before every mutating request.
 */
app.get("/", rateLimiter("public"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const token = generateCSRFToken(auth.firebaseUser.uid);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    return c.json({ csrfToken: token, expires });
  } catch (error) {
    debugLog.error("CSRF token generation error", {
      service: "csrf-route",
      operation: "generateCSRFToken",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to generate CSRF token" }, 500);
  }
});

export default app;
