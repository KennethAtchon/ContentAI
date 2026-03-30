import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { usersService } from "../../domain/singletons";
import { adminAuth } from "../../services/firebase/admin";

const meRouter = new Hono<HonoEnv>();

meRouter.get(
  "/customers-count",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const stats = await usersService.getCustomerStats();

    return c.json(stats);
  },
);

meRouter.delete(
  "/delete-account",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");

    const result = await usersService.deleteOwnAccount(auth.firebaseUser.uid);

    try {
      await adminAuth.deleteUser(auth.firebaseUser.uid);
    } catch {
      /* Best-effort Firebase deletion */
    }

    return c.json(result);
  },
);

meRouter.get(
  "/export-data",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");

    const exportData = await usersService.exportUserData(auth.user.id);

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="my-data.json"',
      },
    });
  },
);

export default meRouter;
