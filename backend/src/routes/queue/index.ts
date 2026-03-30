import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import coreRouter from "./core.router";
import itemsRouter from "./items.router";

const queueRouter = new Hono<HonoEnv>();
queueRouter.route("/", coreRouter);
queueRouter.route("/", itemsRouter);

export default queueRouter;
