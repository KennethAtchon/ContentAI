import { Hono } from "hono";
import { rateLimiter } from "../../middleware/protection";
import { adminAuth } from "../../services/firebase/admin";
import { authService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";

const authRoutes = new Hono();

/**
 * POST /api/auth/register
 *
 * Called by the frontend after Firebase sign-up or Google sign-in.
 * Verifies the Firebase token and upserts the user in Postgres.
 * No auth middleware — the user may not exist in DB yet.
 */
authRoutes.post("/register", rateLimiter("auth"), async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.unauthorized();
  }

  const token = authHeader.substring(7);
  const decoded = await adminAuth.verifyIdToken(token, true);

  const email = decoded.email;
  if (!email) {
    throw Errors.badRequest("Firebase token missing email", "MISSING_EMAIL");
  }

  const name =
    decoded.name || decoded.displayName || email.split("@")[0] || "User";

  const result = await authService.establishSessionUser({
    firebaseUid: decoded.uid,
    email,
    name,
    level: "user",
    hasAdminClaim: false,
  });

  if (!result.ok) {
    throw Errors.forbidden();
  }

  return c.json({ user: result.user }, 200);
});

export default authRoutes;
