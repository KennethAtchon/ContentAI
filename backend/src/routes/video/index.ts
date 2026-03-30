import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import {
  deriveUseClipAudioByIndex,
  extractCaptionSourceText,
  formatAssTime,
  parseScriptShots,
} from "./utils";
import jobsRouter from "./jobs.router";
import reelGenerateRouter from "./reel-generate.router";
import shotRegenerateRouter from "./shot-regenerate.router";
import timelineValidateRouter from "./timeline-validate.router";

export {
  getRetryRunner,
  runReelGeneration,
  runShotRegenerate,
} from "../../domain/video/reel-job-runner";

const app = new Hono<HonoEnv>();
app.route("/", reelGenerateRouter);
app.route("/", shotRegenerateRouter);
app.route("/", jobsRouter);
app.route("/", timelineValidateRouter);

export const __videoRouteTestUtils = {
  parseScriptShots,
  extractCaptionSourceText,
  deriveUseClipAudioByIndex,
  formatAssTime,
};

export default app;
