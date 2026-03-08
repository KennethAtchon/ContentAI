# Log Aggregation Runbook

**Status:** App emits structured JSON logs; wire up an aggregator after first deploy.

---

## Current Logging Setup

The app uses a structured logger (`shared/utils/debug.ts`) that emits JSON to stdout.
Railway captures all stdout/stderr automatically.

**Log levels:** `error`, `warn`, `info`, `debug`  
**Format:** JSON with `level`, `message`, `service`, `operation`, `timestamp`, and optional context fields

---

## Log Retention Targets

| Store | Minimum retention |
|-------|------------------|
| Railway built-in | 30 days (Hobby/Pro plan) |
| External aggregator | 90 days |

See `data-retention-policy.md` for full policy.

---

## Option A — Railway Observability (simplest)

Railway Pro includes built-in log search (no setup required).

1. Railway Dashboard → Project → Observability → Logs
2. Filter by service, level, or keyword
3. Set up log alerts via Observability → Alerts

**Limitation:** 30-day retention; no long-term archive.

---

## Option B — Better Stack Logs (recommended — free tier available)

1. Sign up at [betterstack.com/logs](https://betterstack.com/logs)
2. Create a new source → copy the **Source token**
3. Add to Railway environment variables:
   ```
   BETTERSTACK_SOURCE_TOKEN=<token>
   ```
4. Update `shared/utils/debug.ts` to also send to Better Stack HTTP ingest:
   ```
   POST https://in.logs.betterstack.com
   Authorization: Bearer <BETTERSTACK_SOURCE_TOKEN>
   ```
5. Better Stack provides 90-day retention, search, alerts, and dashboards

---

## Option C — Datadog Logs

1. Add `DD_API_KEY` and `DD_SITE=datadoghq.com` to Railway environment variables
2. Install Datadog log forwarder (Railway add-on or Docker sidecar)
3. Configure log pipeline in Datadog UI to parse JSON fields

---

## Option D — Loki + Grafana (self-hosted)

If you run your own Grafana stack:

```yaml
# docker-compose.yml (monitoring stack)
services:
  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
  promtail:
    image: grafana/promtail:latest
    # Point to Railway log drain endpoint
  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
```

Configure Railway log drain to forward to Promtail.

---

## Querying Logs

### Common queries (Railway / Better Stack / Datadog)

```
# All errors in last hour
level:error

# Payment failures
service:stripe-webhook message:payment_failed

# Auth failures
service:firebase-middleware level:warn

# Slow API responses
service:api-route-protection message:slow_request

# Specific user
userId:<user-id>
```

---

## Log Drain Setup (Railway)

Railway supports log drains to forward logs to external services:

1. Railway Dashboard → Project → Settings → Log Drains
2. Add endpoint URL from your aggregator (Better Stack, Datadog, etc.)
3. Select services to drain (select all)

---

## See Also

- `data-retention-policy.md` — retention thresholds
- `alerting.md` — log-based alert rules
- `incident-response.md` — using logs during an incident
