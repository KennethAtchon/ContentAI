import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import nichesRouter from "./niches";
import musicAdminRouter from "./music";
import configAdminRouter from "./config";
import verifyRouter from "./verify.router";
import analyticsRouter from "./analytics.router";
import customersRouter from "./customers.router";
import ordersRouter from "./orders.router";
import subscriptionsRouter from "./subscriptions.router";
import featureUsagesRouter from "./feature-usages.router";
import costsRouter from "./costs.router";
import systemRouter from "./system.router";

const admin = new Hono<HonoEnv>();

admin.route("/", nichesRouter);
admin.route("/", musicAdminRouter);
admin.route("/", configAdminRouter);
admin.route("/", verifyRouter);
admin.route("/", analyticsRouter);
admin.route("/", customersRouter);
admin.route("/", ordersRouter);
admin.route("/", subscriptionsRouter);
admin.route("/", featureUsagesRouter);
admin.route("/", costsRouter);
admin.route("/", systemRouter);

export default admin;
