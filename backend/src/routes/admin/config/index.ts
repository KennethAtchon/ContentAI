import { Hono } from "hono";
import type { HonoEnv } from "../../../types/hono.types";
import statusRouter from "./status.router";
import crudRouter from "./crud.router";
import cacheRouter from "./cache.router";

const configAdminRouter = new Hono<HonoEnv>();

configAdminRouter.route("/", statusRouter);
configAdminRouter.route("/", crudRouter);
configAdminRouter.route("/", cacheRouter);

export default configAdminRouter;
