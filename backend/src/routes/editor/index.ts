import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import editorAssetsRouter from "./assets.router";
import projectsRouter from "./editor-projects.router";
import exportRouter from "./editor-export.router";
import aiRouter from "./editor-ai.router";
import forkVersionsRouter from "./editor-fork-versions.router";

const app = new Hono<HonoEnv>();

app.route("/assets", editorAssetsRouter);
app.route("/", projectsRouter);
app.route("/", exportRouter);
app.route("/", aiRouter);
app.route("/", forkVersionsRouter);

export default app;
