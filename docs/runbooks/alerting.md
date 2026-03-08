# Alerting Rules Runbook

**Status:** Alerting thresholds defined here; wire up in your observability provider after deploy.

---

## Alert Tiers

| Severity | Response time | Channel |
|----------|--------------|---------|
| **Critical** | 5 min | PagerDuty / phone call |
| **Warning** | 30 min | Slack `#alerts` + email |
| **Info** | Next business day | Slack `#engineering` |

---

## Infrastructure Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| App down | `/api/health` returns non-200 for ≥ 2 consecutive checks | Critical |
| High error rate | HTTP 5xx rate > 5% over 5 min | Critical |
| High latency | p95 response time > 3 s over 5 min | Warning |
| Memory high | Container memory > 85% for 10 min | Warning |
| CPU high | CPU usage > 80% for 10 min | Warning |
| Disk high | Disk usage > 80% | Warning |
| SSL expiry | Certificate expires in < 30 days | Warning |

---

## Database Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| DB connection failed | `prisma.$connect()` throws for 3 consecutive health checks | Critical |
| Slow queries | Queries > 2 s (logged via `slow_statement_timeout`) | Warning |
| Replication lag | Lag > 30 s (if using read replicas) | Warning |
| Backup missed | Daily backup not completed by 06:00 UTC | Warning |

---

## Application Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Payment failure spike | Stripe webhook `payment_intent.payment_failed` > 10 events / 5 min | Warning |
| Auth failure spike | Firebase 401 responses > 50 / 5 min | Warning |
| Rate limit saturation | 429 rate > 20% of requests over 5 min | Warning |
| Unhandled error spike | Uncaught exceptions > 10 / min | Critical |
| High signup failure | Sign-up errors > 5% over 15 min | Warning |

---

## Business Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| No new signups | Zero new users in 24 h (business hours only) | Info |
| Subscription churn spike | > 5 cancellations / hour | Info |

---

## Configuring Alerts

### Option A — Railway Metrics (built-in)

Railway provides CPU / memory / network graphs. Use webhook alerts:
1. Railway Dashboard → Project → Observability → Alerts
2. Add threshold rules from the Infrastructure table above
3. Configure Slack webhook or email notification

### Option B — Datadog

```bash
# In Railway environment variables, add:
DD_API_KEY=<your-key>
DD_SITE=datadoghq.com

# Datadog Agent auto-collects Railway metrics
# Set up monitors in Datadog UI using the thresholds above
```

### Option C — Prometheus + Grafana (self-hosted)

The app already exposes `/api/metrics` (Prometheus format, requires `METRICS_SECRET` bearer token).

```yaml
# prometheus.yml
scrape_configs:
  - job_name: your-app
    static_configs:
      - targets: ['your-app.com']
    metrics_path: /api/metrics
    bearer_token: <METRICS_SECRET>
    scheme: https
```

Create Grafana alert rules from the tables above.

---

## Slack Integration

Set `SLACK_WEBHOOK_URL` in Railway environment variables (or your monitoring provider) to route alerts to `#alerts`.

---

## See Also

- `uptime-monitoring.md` — external uptime checks
- `incident-response.md` — how to respond to alerts
- `on-call.md` — who is on-call
