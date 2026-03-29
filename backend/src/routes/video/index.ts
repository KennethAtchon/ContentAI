import { Hono } from "hono";
import type { HonoEnv } from "../../middleware/protection";
import {
  deriveUseClipAudioByIndex,
  extractCaptionSourceText,
  formatAssTime,
  parseScriptShots,
} from "./utils";
import jobsRouter from "./jobs.router";
import reelGenerateRouter from "./reel-generate.router";
import shotRegenerateRouter from "./shot-regenerate.router";

export { getRetryRunner, runReelGeneration, runShotRegenerate } from "./reel-job-runner";

const app = new Hono<HonoEnv>();
app.route("/", reelGenerateRouter);
app.route("/", shotRegenerateRouter);
app.route("/", jobsRouter);

export const __videoRouteTestUtils = {
  parseScriptShots,
  extractCaptionSourceText,
  deriveUseClipAudioByIndex,
  formatAssTime,
};

export default app;
