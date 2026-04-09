import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import { createHash } from "crypto";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { ADMIN_SPECIAL_CODE_HASH } from "../../utils/config/envUtil";
import { adminAuth } from "../../services/firebase/admin";
import { adminService } from "../../domain/singletons";
import { AppError, Errors } from "../../utils/errors/app-error";
import { adminVerifyBodySchema } from "../../domain/admin/admin.schemas";

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
  zValidator("json", adminVerifyBodySchema, zodValidationErrorHook),
  async (c) => {
    const { adminCode } = c.req.valid("json");

    if (!ADMIN_SPECIAL_CODE_HASH) {
      throw Errors.notConfigured("Admin verification not properly configured");
    }

    const hashedInput = createHash("sha256").update(adminCode).digest("hex");
    const trueAdminHash = createHash("sha256")
      .update(ADMIN_SPECIAL_CODE_HASH)
      .digest("hex");

    if (hashedInput !== trueAdminHash) {
      throw new AppError("Invalid admin code", "INVALID_ADMIN_CODE", 403);
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
  },
);

export default verifyRouter;
