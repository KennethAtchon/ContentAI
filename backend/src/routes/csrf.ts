import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../middleware/protection";
import type { HonoEnv } from "../types/hono.types";
import { generateCSRFToken } from "../services/csrf/csrf-protection";

const app = new Hono<HonoEnv>();

/**
 * GET /api/csrf
 * Returns a CSRF token for the authenticated user.
 * Used by authenticated-fetch.ts before every mutating request.
 */
app.get("/", rateLimiter("public"), authMiddleware("user"), async (c) => {
  const auth = c.get("auth");
  const token = generateCSRFToken(auth.firebaseUser.uid);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  return c.json({ csrfToken: token, expires });
});

export default app;
