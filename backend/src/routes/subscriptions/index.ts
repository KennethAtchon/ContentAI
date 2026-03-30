import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import currentRouter from "./current.router";
import portalRouter from "./portal.router";
import checkoutRouter from "./checkout.router";

const subscriptions = new Hono<HonoEnv>();

subscriptions.route("/", currentRouter);
subscriptions.route("/", portalRouter);
subscriptions.route("/", checkoutRouter);

export default subscriptions;
