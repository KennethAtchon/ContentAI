import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import sessionsRouter from "./sessions.router";
import sendMessageRouter from "./send-message.router";

const app = new Hono<HonoEnv>();

app.route("/", sessionsRouter);
app.route("/", sendMessageRouter);

export default app;
