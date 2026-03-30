import { Hono } from "hono";
import type { HonoEnv } from "../../../types/hono.types";
import listRouter from "./list.router";
import analyticsRouter from "./analytics.router";

const subscriptionsModule = new Hono<HonoEnv>();

subscriptionsModule.route("/", analyticsRouter);
subscriptionsModule.route("/", listRouter);

export default subscriptionsModule;
