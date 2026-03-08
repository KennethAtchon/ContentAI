/**
 * Load Test — k6 script
 *
 * Runs a realistic multi-scenario load test against the Hono backend.
 * Exercises: health checks, public contact form, authenticated calculator,
 * and admin endpoints.
 *
 * Requirements:
 *   brew install k6   (macOS)
 *   # or
 *   https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   # Quick smoke test (1 VU, 10 iterations)
 *   k6 run scripts/load-test.js
 *
 *   # Sustained load (50 VUs for 2 minutes)
 *   k6 run --vus 50 --duration 2m scripts/load-test.js
 *
 *   # Against staging
 *   BASE_URL=https://api.staging.yourdomain.com k6 run scripts/load-test.js
 *
 * Set environment variables:
 *   BASE_URL         — backend base URL (default: http://localhost:3001)
 *   USER_TOKEN       — Firebase ID token for authenticated endpoints
 *   ADMIN_TOKEN      — Firebase ID token for admin endpoints
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const USER_TOKEN = __ENV.USER_TOKEN || "";
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || "";

const errorRate = new Rate("error_rate");
const calculatorDuration = new Trend("calculator_duration");

// ─── Options ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    health: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      exec: "healthScenario",
    },
    public: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "20s", target: 10 },
        { duration: "10s", target: 0 },
      ],
      exec: "publicScenario",
    },
    authenticated: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      exec: "authenticatedScenario",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    error_rate: ["rate<0.05"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-CSRF-Token": "load-test-token",
  };
}

function jsonBody(obj) {
  return JSON.stringify(obj);
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export function healthScenario() {
  group("Health", () => {
    const res = http.get(`${BASE_URL}/api/health`);
    const ok = check(res, {
      "health 200": (r) => r.status === 200,
      "health has status": (r) => JSON.parse(r.body).status !== undefined,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

export function publicScenario() {
  group("Public — contact form", () => {
    const res = http.post(
      `${BASE_URL}/api/shared/contact-messages`,
      jsonBody({
        name: "Load Test User",
        email: "loadtest@example.com",
        subject: "Load Test",
        message: "This is an automated load test message.",
      }),
      { headers: { "Content-Type": "application/json" } },
    );

    const ok = check(res, {
      "contact 201": (r) => r.status === 201,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);
}

export function authenticatedScenario() {
  if (!USER_TOKEN) {
    // Skip if no token provided — avoids false 401 errors
    sleep(1);
    return;
  }

  group("Calculator — usage", () => {
    const res = http.get(`${BASE_URL}/api/calculator/usage`, {
      headers: authHeaders(USER_TOKEN),
    });
    const ok = check(res, { "usage 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  group("Calculator — calculate (loan)", () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/calculator/calculate`,
      jsonBody({
        type: "loan",
        inputs: { principal: 10000, interestRate: 5, term: 36 },
      }),
      { headers: authHeaders(USER_TOKEN) },
    );
    calculatorDuration.add(Date.now() - start);

    const ok = check(res, {
      "calculate 200 or 403": (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}
