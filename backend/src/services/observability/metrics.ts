/**
 * Prometheus metrics for Grafana Cloud (or any Prometheus-compatible scraper).
 * Used for observability: request rate, latency, error spikes, DB and pool metrics.
 * Only runs server-side; METRICS_ENABLED gates collection and /api/metrics.
 *
 * prom-client uses Node.js built-ins (fs, v8, cluster, perf_hooks) that do not
 * exist in the browser.  We must NOT import it at the top level because this
 * module is transitively imported by client components.  Instead we use a
 * lazy require() that is only ever executed when serverOnly() returns true
 * (i.e. inside a Node.js process), so the bundler never needs to resolve it
 * for the browser / Edge bundle.
 */

import { METRICS_ENABLED } from "@/utils/config/envUtil";

// Declare window global for server-side environment detection
declare const window: undefined | object;

// -----------------------------------------------------------------------------
// Types (declared locally so we never import from prom-client at the top level)
// -----------------------------------------------------------------------------
type PromRegistry = {
  metrics(): Promise<string>;
};
type PromCounter = {
  labels(...args: string[]): { inc(): void };
  inc(): void;
};
type PromHistogram = {
  labels(...args: string[]): { observe(v: number): void };
};
type PromGauge = {
  set(v: number): void;
};

// Lazily-initialised singletons — only created on the server.
let _registry: PromRegistry | null = null;
let _httpRequestsTotal: PromCounter | null = null;
let _httpRequestDurationSeconds: PromHistogram | null = null;
let _errorsTotal: PromCounter | null = null;
let _unhandledRejectionsTotal: PromCounter | null = null;
let _uncaughtExceptionsTotal: PromCounter | null = null;
let _dbQueryDurationSeconds: PromHistogram | null = null;
let _dbConnectionPoolActive: PromGauge | null = null;
let _dbConnectionPoolIdle: PromGauge | null = null;
let _dbConnectionPoolMax: PromGauge | null = null;
let _appUptimeSeconds: PromGauge | null = null;
let _compositionEventsTotal: PromCounter | null = null;
let _compositionLatencySeconds: PromHistogram | null = null;
let _initialised = false;

function init() {
  if (_initialised) return;
  _initialised = true;

  const { Registry, Counter, Histogram, Gauge } = require("prom-client");

  _registry = new Registry();

  _httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_class"],
    registers: [_registry],
  });

  _httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [_registry],
  });

  _errorsTotal = new Counter({
    name: "errors_total",
    help: "Total number of reported errors",
    labelNames: ["category", "severity"],
    registers: [_registry],
  });

  _unhandledRejectionsTotal = new Counter({
    name: "unhandled_rejections_total",
    help: "Total number of unhandled promise rejections",
    registers: [_registry],
  });

  _uncaughtExceptionsTotal = new Counter({
    name: "uncaught_exceptions_total",
    help: "Total number of uncaught exceptions",
    registers: [_registry],
  });

  _dbQueryDurationSeconds = new Histogram({
    name: "db_query_duration_seconds",
    help: "Database query duration in seconds",
    labelNames: ["model", "operation", "status"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [_registry],
  });

  _dbConnectionPoolActive = new Gauge({
    name: "db_connection_pool_active",
    help: "Number of active database connections",
    registers: [_registry],
  });

  _dbConnectionPoolIdle = new Gauge({
    name: "db_connection_pool_idle",
    help: "Number of idle database connections",
    registers: [_registry],
  });

  _dbConnectionPoolMax = new Gauge({
    name: "db_connection_pool_max",
    help: "Maximum database connections in pool",
    registers: [_registry],
  });

  _appUptimeSeconds = new Gauge({
    name: "app_uptime_seconds",
    help: "Application uptime in seconds",
    registers: [_registry],
  });

  _compositionEventsTotal = new Counter({
    name: "composition_events_total",
    help: "Total composition save/validate/render events",
    labelNames: ["event", "status"],
    registers: [_registry],
  });

  _compositionLatencySeconds = new Histogram({
    name: "composition_latency_seconds",
    help: "Composition operation latency in seconds",
    labelNames: ["event"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [_registry],
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/** Status class for low-cardinality labels: 2xx, 4xx, 5xx */
function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

/** Normalize pathname to a route label to limit cardinality (max 4 segments, collapse IDs). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeRouteLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean).slice(0, 4);
  const normalized = segments.map((seg) => {
    if (UUID_REGEX.test(seg) || /^\d+$/.test(seg)) return ":id";
    return seg;
  });
  return "/" + normalized.join("/");
}

// -----------------------------------------------------------------------------
// Public API (no-op when METRICS_ENABLED is false or in browser)
// -----------------------------------------------------------------------------
function serverOnly(): boolean {
  return typeof window === "undefined" && METRICS_ENABLED;
}

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number,
): void {
  if (!serverOnly()) return;
  init();
  const routeLabel = normalizeRouteLabel(route);
  const statusLabel = statusClass(status);
  _httpRequestsTotal!.labels(method, routeLabel, statusLabel).inc();
  _httpRequestDurationSeconds!
    .labels(method, routeLabel)
    .observe(durationMs / 1000);
}

export function recordError(category: string, severity: string): void {
  if (!serverOnly()) return;
  init();
  _errorsTotal!.labels(category, severity).inc();
}

export function recordUnhandledRejection(): void {
  if (!serverOnly()) return;
  init();
  _unhandledRejectionsTotal!.inc();
}

export function recordUncaughtException(): void {
  if (!serverOnly()) return;
  init();
  _uncaughtExceptionsTotal!.inc();
}

export function recordDbQuery(
  model: string,
  operation: string,
  durationMs: number,
  status: "ok" | "error",
): void {
  if (!serverOnly()) return;
  init();
  _dbQueryDurationSeconds!
    .labels(model, operation, status)
    .observe(durationMs / 1000);
}

export function recordConnectionPool(
  active: number,
  idle: number,
  max: number,
): void {
  if (!serverOnly()) return;
  init();
  _dbConnectionPoolActive!.set(active);
  _dbConnectionPoolIdle!.set(idle);
  _dbConnectionPoolMax!.set(max);
}

/** Call before generating /api/metrics output to set uptime. */
export function setUptimeSeconds(seconds: number): void {
  if (!serverOnly()) return;
  init();
  _appUptimeSeconds!.set(seconds);
}

/** Returns Prometheus text format for GET /api/metrics. */
export async function getMetricsContent(): Promise<string> {
  if (!serverOnly()) return "";
  init();
  setUptimeSeconds(process.uptime());
  return _registry!.metrics();
}

export function isMetricsEnabled(): boolean {
  return typeof window === "undefined" && METRICS_ENABLED;
}

/** Exposed for the /api/metrics route which needs to call registry.metrics() directly. */
export function getRegistry(): PromRegistry | null {
  if (!serverOnly()) return null;
  init();
  return _registry;
}

/** Named export for tests and direct consumers that need the registry instance. */
export const registry = {
  get: () => getRegistry(),
};

/** Returns a summary of error-related counters for the /api/health/error-monitoring endpoint. */
export function getErrorMetrics(): Record<string, unknown> {
  return {
    metricsEnabled: METRICS_ENABLED,
    errorsTotal: _errorsTotal !== null ? "available" : "unavailable",
    unhandledRejections:
      _unhandledRejectionsTotal !== null ? "available" : "unavailable",
    uncaughtExceptions:
      _uncaughtExceptionsTotal !== null ? "available" : "unavailable",
    initialised: _initialised,
  };
}

export function recordCompositionEvent(
  event: "init" | "save" | "validate" | "render" | "render_retry",
  status: "ok" | "error" | "conflict" | "validation_failed",
): void {
  if (!serverOnly()) return;
  init();
  _compositionEventsTotal!.labels(event, status).inc();
}

export function recordCompositionLatency(
  event: "init" | "save" | "validate" | "render",
  durationMs: number,
): void {
  if (!serverOnly()) return;
  init();
  _compositionLatencySeconds!.labels(event).observe(durationMs / 1000);
}
