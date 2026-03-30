import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import { systemConfigService } from "../../../domain/singletons";
import {
  buildAdminAiProvidersStatus,
  buildAdminApiKeysStatus,
  buildAdminVideoProvidersStatus,
} from "../../../domain/admin/admin-config-status";

const statusRouter = new Hono<HonoEnv>();

statusRouter.get(
  "/config/ai-providers/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const body = await buildAdminAiProvidersStatus();
    return c.json(body);
  },
);

statusRouter.get(
  "/config/video-providers/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const body = await buildAdminVideoProvidersStatus(systemConfigService);
    return c.json(body);
  },
);

statusRouter.get(
  "/config/api-keys/status",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const body = await buildAdminApiKeysStatus(systemConfigService);
    return c.json(body);
  },
);

export default statusRouter;
