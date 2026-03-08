import { Hono } from "hono";
import { rateLimiter } from "../../middleware/protection";
import { adminAuth } from "../../services/firebase/admin";
import { db } from "../../services/db/db";
import { users } from "../../infrastructure/database/drizzle/schema";
import { debugLog } from "../../utils/debug/debug";

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
    return c.json({ error: "Authorization header required" }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token, true);

    const email = decoded.email;
    if (!email) {
      return c.json({ error: "Firebase token missing email" }, 400);
    }

    const name =
      decoded.name || decoded.displayName || email.split("@")[0] || "User";

    const [user] = await db
      .insert(users)
      .values({
        firebaseUid: decoded.uid,
        email,
        name,
        role: "user",
        isActive: true,
        timezone: "UTC",
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: { email, name, lastLogin: new Date() },
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name,
      });

    return c.json({ user }, 200);
  } catch (error) {
    debugLog.error("Auth register error", {
      service: "auth-route",
      operation: "register",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

export default authRoutes;
