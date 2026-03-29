import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { handleRouteError } from "./middleware/error-handler";
import { secureHeaders } from "./middleware/security-headers";
import {
  getAllowedCorsOrigins,
  METRICS_SECRET,
  getEnvVar,
  CRON_JOBS_ENABLED,
} from "./utils/config/envUtil";
import {
  getMetricsContent,
  isMetricsEnabled,
} from "./services/observability/metrics";
import { debugLog } from "./utils/debug/debug";

// Route imports
import healthRoutes from "./routes/health";
import customerRoutes from "./routes/customer/index";
import adminRoutes from "./routes/admin/index";
import subscriptionRoutes from "./routes/subscriptions/index";
import publicRoutes from "./routes/public/index";
import analyticsRoutes from "./routes/analytics/index";
import userRoutes from "./routes/users/index";
import csrfRoutes from "./routes/csrf";
import authRoutes from "./routes/auth/index";
import reelsRoutes from "./routes/reels/index";
import generationRoutes from "./routes/generation/index";
import queueRoutes from "./routes/queue/index";
import projectsRoutes from "./routes/projects/index";
import chatRoutes from "./routes/chat/index";
import audioRoutes from "./routes/audio/index";
import assetsRoutes from "./routes/assets/index";
import musicRoutes from "./routes/music/index";
import editorRoutes from "./routes/editor/index";
import captionsRoutes from "./routes/editor/captions";
import videoRoutes from "./routes/video/index";
import mediaRoutes from "./routes/media/index";
import { startDailyScan } from "./jobs/daily-scan";
import { seedSystemConfig } from "./services/config/config-seed";

const app = new Hono();

app.onError(handleRouteError);

// ─── Global Middleware ─────────────────────────────────────────────────────────

// Request logging
app.use("*", logger());

// CORS — dynamic origin validation
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      const allowed = getAllowedCorsOrigins();
      return allowed.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Requested-With",
      "Accept",
      "Accept-Language",
      "X-Timezone",
    ],
    exposeHeaders: [
      "X-Rate-Limit-Limit",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset",
    ],
    credentials: true,
    maxAge: 86400,
  }),
);

// Security headers for all responses
app.use("*", secureHeaders());

// ─── API Routes ────────────────────────────────────────────────────────────────

app.route("/api/health", healthRoutes);
app.route("/api/customer", customerRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/subscriptions", subscriptionRoutes);
app.route("/api/shared", publicRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/users", userRoutes);
app.route("/api/csrf", csrfRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/reels", reelsRoutes);
app.route("/api/generation", generationRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/audio", audioRoutes);
app.route("/api/assets", assetsRoutes);
app.route("/api/music", musicRoutes);
app.route("/api/editor", editorRoutes);
app.route("/api/captions", captionsRoutes);
app.route("/api/video", videoRoutes);
app.route("/api/media", mediaRoutes);

// Standalone routes
app.get("/api/live", (c) => c.json({ status: "ok" }));
app.get("/api/ready", (c) => c.json({ status: "ready" }));

// Prometheus metrics — protected by bearer token when METRICS_SECRET is set
app.get("/api/metrics", async (c) => {
  if (!isMetricsEnabled()) {
    return c.json({ error: "Metrics not enabled" }, 404);
  }
  if (METRICS_SECRET) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${METRICS_SECRET}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  const content = await getMetricsContent();
  return new Response(content, {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────

const port = parseInt(getEnvVar("PORT", false, "3001"), 10);

debugLog.info(`Hono backend starting on port ${port}`, {
  service: "index",
  operation: "server-start",
  port,
});

// Seed system config defaults, then start cron jobs based on DB flag
seedSystemConfig()
  .then(async () => {
    const { systemConfigService } = await import("./domain/singletons");
    const cronEnabled = await systemConfigService.getBoolean(
      "feature_flags",
      "cron_jobs_enabled",
      CRON_JOBS_ENABLED,
    );
    if (cronEnabled) {
      startDailyScan();
      debugLog.info("Cron jobs enabled", {
        service: "index",
        operation: "cron-init",
      });
    } else {
      debugLog.info("Cron jobs disabled", {
        service: "index",
        operation: "cron-init",
      });
    }
  })
  .catch((err) => {
    debugLog.error("Config seed failed — falling back to ENV for cron flag", {
      service: "index",
      operation: "seed",
      error: String(err),
    });
    if (CRON_JOBS_ENABLED) {
      startDailyScan();
      debugLog.info("Cron jobs enabled (ENV fallback)", {
        service: "index",
        operation: "cron-init",
      });
    }
  });

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // seconds — allows long-running SSE streams
};
