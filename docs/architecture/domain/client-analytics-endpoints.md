## Client analytics endpoints (`/api/analytics`)

The backend exposes **`POST /api/analytics/*`** routes that accept JSON from browsers, **log structured events** through the project logger, and return a simple success payload. They **do not** write to an analytics database, **do not** forward to Segment/Amplitude by default, and **do not** participate in billing or authorization.

This document explains **why they exist**, **how they behave**, and **how to evolve** them without breaking CORS or observability.

---

## Table of contents

1. [Design intent](#design-intent)
2. [What “analytics” means here](#what-analytics-means-here)
3. [Endpoint reference](#endpoint-reference)
4. [Request / response contract](#request--response-contract)
5. [CORS and OPTIONS](#cors-and-options)
6. [Rate limiting](#rate-limiting)
7. [Logging pipeline](#logging-pipeline)
8. [Why there is no analytics DB](#why-there-is-no-analytics-db)
9. [How to use this in investigations](#how-to-use-this-in-investigations)
10. [Product-grade analytics options](#product-grade-analytics-options)
11. [Privacy and PII](#privacy-and-pii)

---

## Design intent

**Problem:** The frontend needs a **low-friction** way to report **UX signals** — form abandonment depth, search latency, Core Web Vitals — without wiring a full third-party SDK on day one.

**Solution:** First-party **ingest endpoints** that:

- Accept **anonymous or pseudonymous** JSON.
- **Never block** the user on failure (fire-and-forget from the client’s perspective).
- Land in **server logs** where engineers already have **grep, Loki, CloudWatch, etc.**

This is **engineering telemetry**, not a replacement for product analytics culture.

---

## What “analytics” means here

| In this module | Not in this module |
|----------------|-------------------|
| Log lines for debugging / trend spotting in infra | Warehoused event streams for PM dashboards |
| Optional correlation with `debugLog` metadata | User identity joins (unless you add them explicitly in payload) |
| Cheap to add new event shapes | Strong schema registry or GDPR export tooling |

---

## Endpoint reference

All implemented in `backend/src/routes/analytics/index.ts`.

| Path | Purpose (intended) |
|------|---------------------|
| `POST /api/analytics/form-completion` | User finished a multi-step form |
| `POST /api/analytics/form-progress` | Partial progress / step depth |
| `POST /api/analytics/search-performance` | Latency, result counts, zero-result rate |
| `POST /api/analytics/web-vitals` | LCP, FID/INP, CLS-style payloads from the browser |

Each has a matching **`OPTIONS`** handler returning **200** for **CORS preflight** from browser `fetch`.

---

## Request / response contract

**Body:** arbitrary JSON (`await c.req.json()`). **No Zod validation** in the current code — shape is **caller-defined**.

**Success:** **`{ success: true }`** with **200**.

**Handler errors:** try/catch returns **`{ success: false }`** with **500** — but the client should **not** depend on success for UX (treat as best-effort).

**Why no strict schema?**

Velocity: different frontends can experiment without coordinated backend deploys. **Tradeoff:** malformed or huge payloads could **bloat logs** — mitigate with **size limits** at reverse proxy or add **Zod** if abuse appears.

---

## CORS and OPTIONS

Browser cross-origin POSTs with JSON trigger **preflight**. Explicit **`OPTIONS ... 200`** on each path avoids intermittent “works in curl, fails in Chrome” issues.

Global CORS for `/api/*` is configured in `backend/src/index.ts`; analytics routes still declare OPTIONS locally for clarity and to match historical patterns.

---

## Rate limiting

All POSTs use **`rateLimiter("public")`** — same class as anonymous-adjacent traffic.

**Why public and not authenticated?**

Many UX events are useful **before** or **without** login (marketing funnel). **Tradeoff:** easier to spam fake events. If volumes grow:

- Switch to **`customer`** for post-auth events only, **or**
- Add **per-IP** + **per-fingerprint** limits at the edge.

---

## Logging pipeline

Each handler does:

```text
debugLog.info("<Human label>", { service: "analytics", operation: "<op>", data })
```

**Properties:**

- **`service: "analytics"`** — filter in log aggregators.
- **`operation`** — discriminates endpoint.
- **`data`** — full parsed body reference (be careful with PII — see below).

**Why `debugLog` not `metrics.counter`?**

These events are **sparse and exploratory**. Prometheus counters could be added later for **aggregates** (e.g. `web_vitals_lcp_seconds_bucket`) without removing logs.

---

## Why there is no analytics DB

- **Cost and complexity** — every event write becomes retention, compaction, PII governance.
- **Duplicate truth** — product teams often still want **Snowflake / BigQuery / third-party** for cohort analysis.
- **YAGNI** — the codebase prioritized **observability for engineers** first.

If you add a warehouse:

- Prefer **async enqueue** (queue, batch) from these handlers rather than blocking HTTP on inserts.

---

## How to use this in investigations

Example queries (syntax depends on your log stack):

- Filter `service="analytics" AND operation="web-vitals"` during a perf regression window.
- Compare `form-progress` step histograms before/after a UX change.

**Correlation:** If the client sends **`sessionId`**, **`route`**, or **`contentId`** in `data`, include those keys consistently so traces line up with server request logs.

---

## Product-grade analytics options

| Approach | Pros | Cons |
|----------|------|------|
| Keep logs only | Zero extra infra | No SQL, poor PM self-serve |
| Export logs → warehouse | Single instrumentation path | Pipeline lag, schema drift |
| Client SDK (PostHog, GA4, etc.) | Rich dashboards, funnels | Privacy policy, consent banners, ad-blockers |
| OpenTelemetry traces + events | Unified with APM | Heavier setup |

This module **does not block** adding a parallel client SDK — they solve different audiences (engineering vs growth).

---

## Privacy and PII

**Do not** put raw emails, full payment details, or health data in `data` without **redaction** and **legal review**.

If forms log field names, prefer **hashed** or **categorical** labels (`field: "step_3_address"` vs full address value).

---

## Related documentation

- [Logging & monitoring](../core/logging-monitoring.md)
- [Performance](../core/performance.md)
- [Security](../core/security.md)
