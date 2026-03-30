import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import usageProfileRouter from "./usage-profile.router";
import ordersRouter from "./orders.router";
import userSettingsRouter from "./settings";

const customer = new Hono<HonoEnv>();

customer.route("/", usageProfileRouter);
customer.route("/", ordersRouter);
customer.route("/settings", userSettingsRouter);

export default customer;
