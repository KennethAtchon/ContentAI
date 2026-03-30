import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { STRIPE_SECRET_KEY } from "../../utils/config/envUtil";
import { adminDb } from "../../services/firebase/admin";
import { usersService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import Stripe from "stripe";
import { createCheckoutSessionBodySchema } from "../../domain/subscriptions/subscriptions.schemas";
import { createSubscriptionCheckoutSession } from "../../domain/subscriptions/subscription-flows";
import { subscriptionsValidationErrorHook } from "./shared-validation";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const checkoutRouter = new Hono<HonoEnv>();

checkoutRouter.post(
  "/checkout",
  rateLimiter("payment"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator(
    "json",
    createCheckoutSessionBodySchema,
    subscriptionsValidationErrorHook,
  ),
  async (c) => {
    if (!stripe) throw Errors.internal("Stripe not configured");

    const auth = c.get("auth");
    const { priceId, tier, billingCycle, trialEnabled } = c.req.valid("json");

    const url = await createSubscriptionCheckoutSession(
      stripe,
      adminDb,
      usersService,
      {
        uid: auth.firebaseUser.uid,
        userId: auth.user.id,
        email: auth.user.email ?? "",
        priceId,
        tier,
        billingCycle,
        trialEnabled,
        requestOrigin: c.req.header("origin") ?? null,
      },
    );

    return c.json({ url });
  },
);

export default checkoutRouter;
