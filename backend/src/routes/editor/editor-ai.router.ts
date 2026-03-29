import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import assemblyRouter from "./editor-ai-assembly.router";
import linkContentRouter from "./editor-link-content.router";

const aiRouter = new Hono<HonoEnv>();
aiRouter.route("/", assemblyRouter);
aiRouter.route("/", linkContentRouter);

export default aiRouter;
