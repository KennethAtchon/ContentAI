import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import listRouter from "./list.router";
import mediaRouter from "./media.router";
import uploadRouter from "./upload.router";
import mutateRouter from "./mutate.router";

const app = new Hono<HonoEnv>();

app.route("/", listRouter);
app.route("/", mediaRouter);
app.route("/", uploadRouter);
app.route("/", mutateRouter);

export default app;
