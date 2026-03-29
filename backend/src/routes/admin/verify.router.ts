import { Hono } from "hono";
import { createHash } from "crypto";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { ADMIN_SPECIAL_CODE_HASH } from "../../utils/config/envUtil";
import { adminAuth } from "../../services/firebase/admin";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const verifyRouter = new Hono<HonoEnv>();

verifyRouter.get(
  "/verify",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const auth = c.get("auth");
    return c.json({
      success: true,
      message: "Admin access verified",
      user: auth.user,
    });
  },
);

verifyRouter.post(
  "/verify",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { adminCode } = body;

      if (!adminCode) return c.json({ error: "Admin code is required" }, 400);

      if (!ADMIN_SPECIAL_CODE_HASH) {
        return c.json(
          { error: "Admin verification not properly configured" },
          500,
        );
      }

      const hashedInput = createHash("sha256").update(adminCode).digest("hex");
      const trueAdminHash = createHash("sha256")
        .update(ADMIN_SPECIAL_CODE_HASH)
        .digest("hex");

      if (hashedInput !== trueAdminHash) {
        return c.json({ error: "Invalid admin code" }, 403);
      }

      const auth = c.get("auth");
      const uid = auth.firebaseUser.uid;

      await adminService.grantAdminViaCode({
        firebaseUid: uid,
        email: auth.firebaseUser.email || "",
        name: (auth.firebaseUser.name as string) || "Admin User",
      });

      await adminAuth.setCustomUserClaims(uid, { role: "admin" });

      return c.json({
        success: true,
        message: "Admin role granted successfully",
      });
    } catch (error) {
      debugLog.error("Admin verification error", {
        service: "admin-route",
        operation: "verifyAdmin",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Admin verification failed" }, 500);
    }
  },
);

export default verifyRouter;
