import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { queueService, customerService } from "../../domain/singletons";
import { getFeatureLimitsForStripeRole } from "../../constants/subscription.constants";
import {
  getProfileWithOAuthFlag,
  updateCustomerProfile,
} from "../../domain/customer/customer-profile-firebase";
import { updateCustomerProfileSchema } from "../../domain/customer/customer.schemas";
import { customerValidationErrorHook } from "./shared-validation";

const usageProfileRouter = new Hono<HonoEnv>();

usageProfileRouter.get(
  "/usage",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const userId = auth.user.id;
    const stripeRole = auth.firebaseUser.stripeRole;

    const limits = getFeatureLimitsForStripeRole(stripeRole);
    const queueSize = await queueService.countScheduledForUser(userId);

    const stats = await customerService.getUsageStats(
      userId,
      stripeRole ?? null,
      queueSize,
      limits,
    );

    return c.json(stats);
  },
);

usageProfileRouter.get(
  "/profile",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const body = await getProfileWithOAuthFlag(
      customerService,
      auth.user.id,
      auth.firebaseUser?.uid,
    );
    return c.json(body);
  },
);

usageProfileRouter.put(
  "/profile",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", updateCustomerProfileSchema, customerValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { name, email, phone, address, timezone } = c.req.valid("json");

    const updatedUser = await updateCustomerProfile(customerService, {
      userId: auth.user.id,
      firebaseUid: auth.firebaseUser.uid,
      currentEmail: auth.user.email,
      patch: { name, email, phone, address, timezone },
    });

    return c.json({
      message: "Profile updated successfully",
      profile: updatedUser,
    });
  },
);

export default usageProfileRouter;
