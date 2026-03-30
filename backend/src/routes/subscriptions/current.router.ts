import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminDb } from "../../services/firebase/admin";
import { usersService } from "../../domain/singletons";
import { getCurrentSubscriptionPayload } from "../../domain/subscriptions/subscription-flows";

const currentRouter = new Hono<HonoEnv>();

currentRouter.get(
  "/current",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const uid = auth.firebaseUser.uid;

    const body = await getCurrentSubscriptionPayload(
      adminDb,
      usersService,
      uid,
      auth.user.id,
    );

    return c.json(body);
  },
);

export default currentRouter;
