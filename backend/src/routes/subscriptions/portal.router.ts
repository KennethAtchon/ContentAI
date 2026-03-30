import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { Errors } from "../../utils/errors/app-error";
import { createStripeCustomerPortalUrl } from "../../domain/subscriptions/subscription-flows";

const portalRouter = new Hono<HonoEnv>();

portalRouter.post(
  "/portal",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) throw Errors.unauthorized();

    const portalUrl = await createStripeCustomerPortalUrl(
      token,
      c.req.header("origin") ?? null,
    );

    return c.json({ url: portalUrl });
  },
);

export default portalRouter;
