# Observability: Error Monitoring & Notifications

**Items 38, 39, 40, 41 — Feb 21, 2026**

---

## Overview

This runbook covers:
- **Item 38:** Error grouping/deduplication and error notifications
- **Item 39:** Business metrics dashboard
- **Item 40:** Failed login attempt monitoring
- **Item 41:** Intrusion detection

---

## Item 38 — Error Grouping & Notifications

### Current state

The app already tracks errors via the `/api/health/error-monitoring` endpoint and internal error boundary. Errors are logged to stdout/Railway logs but not routed to an external error tracker.

### Recommended: Sentry (free tier available)

#### Setup

```bash
cd project
bun add @sentry/nextjs
```

```bash
# In Railway environment variables:
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-app
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

```javascript
// sentry.client.config.js
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,       // 10% of transactions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  environment: process.env.NODE_ENV,
});

// sentry.server.config.js
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

#### Alert Rules in Sentry

Create the following alert rules (Sentry → Alerts → Create Alert):

| Alert | Condition | Action |
|-------|-----------|--------|
| New issue | First occurrence of any error | Email + Slack `#alerts` |
| Error spike | > 10 errors/min | Email + Slack `#alerts` (Critical) |
| Payment error | Any error in `stripe-webhook` service | Email immediately |
| Auth error | Any error in `firebase-middleware` | Email immediately |

---

## Item 39 — Business Metrics Dashboard

### Current state

Business events are tracked in the app (calculator usage, signups, conversions).
No dashboard consumes them yet.

### Option A — Railway Metrics + Custom Dashboard

The `/api/metrics` endpoint exposes Prometheus metrics. Create a Grafana dashboard with:

| Panel | Metric | Visualization |
|-------|--------|--------------|
| Daily active users | `your_app_active_users_total` | Time series |
| Calculator usage by type | `your_app_feature_usage_total{type}` | Bar chart |
| Subscription signups | `your_app_subscriptions_created_total` | Counter |
| Revenue (MRR) | `your_app_mrr_usd` | Gauge |
| Churn rate | `your_app_subscriptions_cancelled_total` | Time series |

### Option B — Stripe Dashboard

Stripe's built-in dashboard provides MRR, churn, and revenue metrics out of the box:
- Stripe Dashboard → Revenue → Overview

### Option C — PostHog (free tier — product analytics)

```bash
bun add posthog-js posthog-node
# NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
# NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Track events:
- `signup_completed`
- `subscription_started`
- `calculator_used` (with `type` property)
- `export_downloaded`
- `subscription_cancelled`

---

## Item 40 — Failed Login Attempt Monitoring

### Current state

Firebase Authentication handles login; failed attempts are not currently aggregated for alerting.

### Implementation

Firebase Authentication provides audit logs. Enable them:

1. Google Cloud Console → IAM & Admin → Audit Logs
2. Enable **Data Access** logs for **Identity Toolkit API**
3. Export to Cloud Logging → Log Router → create a sink to BigQuery or Cloud Storage

#### Alert on Failed Logins

Add a log-based alert in Google Cloud Monitoring:

```
resource.type="identitytoolkit.googleapis.com/Project"
protoPayload.status.code=7  # PERMISSION_DENIED (failed auth)
```

**Alert threshold:** > 20 failed login events from the same IP within 5 minutes → **Warning** alert.

#### Application-Level Tracking

To track failed logins in the app logs, add to the sign-in handler:

```typescript
// In the catch block of sign-in handling:
debugLog.warn("Failed login attempt", {
  service: "auth",
  operation: "sign-in",
  email: redactEmail(email), // redact to last 3 chars + domain
  errorCode: firebaseError.code,
});
```

---

## Item 41 — Intrusion Detection

### Current state

No dedicated IDS/WAF is configured beyond application-level rate limiting.

### Cloudflare WAF (configured as part of item 20)

Cloudflare's WAF provides the first layer of intrusion detection:

1. Cloudflare Dashboard → Security → WAF → Managed Rules
2. Enable **OWASP Core Ruleset**
3. Enable **Cloudflare Managed Ruleset**
4. Set action to **Block** for High confidence rules
5. Enable **Bot Fight Mode** → Security → Bots

#### Custom WAF Rules

```
# Block requests with SQLi patterns in query params
(http.request.uri.query contains "' OR " or 
 http.request.uri.query contains "UNION SELECT" or
 http.request.uri.query contains "<script")
→ Block

# Rate limit sign-in endpoint
(http.request.uri.path eq "/api/auth/sign-in")
→ Rate limit: 10 requests/minute per IP

# Block known bad user agents
(http.user_agent contains "sqlmap" or
 http.user_agent contains "nikto" or
 http.user_agent contains "masscan")
→ Block
```

### Application-Level Monitoring

The app's existing rate limiter (`api-route-protection.ts`) blocks repeated requests per user.
To add IP-level blocking, Redis-based rate limiting already in place can be extended:

```typescript
// Track suspicious patterns and log for review
if (consecutiveFailures > 5) {
  debugLog.warn("Possible brute force", {
    service: "api-route-protection",
    ip: request.headers.get("x-forwarded-for"),
    path: request.nextUrl.pathname,
  });
}
```

### Recommended Next Step

For advanced IDS, consider:
- **Cloudflare Zero Trust** — identity-aware access policies
- **CrowdSec** — open-source collaborative IPS (free)

---

## See Also

- `alerting.md` — full alert threshold reference
- `on-call.md` — who responds to alerts
- `security-incident-response.md` — what to do after a breach
- `docs/AI_Orchestrator/consider/owasp-top10-review.md`
