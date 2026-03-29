import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHash } from "crypto";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { ADMIN_SPECIAL_CODE_HASH } from "../../utils/config/envUtil";
import { adminAuth } from "../../services/firebase/admin";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";
import { adminVerifyBodySchema } from "../../domain/admin/admin.schemas";

const verifyRouter = new Hono<HonoEnv>();
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
  zValidator("json", adminVerifyBodySchema, validationErrorHook),
  async (c) => {
    try {
      const { adminCode } = c.req.valid("json");

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
