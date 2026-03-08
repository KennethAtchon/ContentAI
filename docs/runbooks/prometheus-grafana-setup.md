# Prometheus + Grafana Setup

**The app is fully instrumented.** This runbook covers everything you need to do manually to wire up scraping and dashboards.

---

## What's Already Built

The app exposes a Prometheus-format metrics endpoint at `/api/metrics`.

**Env vars that control it:**

| Variable | Purpose | Example |
|----------|---------|---------|
| `METRICS_ENABLED` | Enables the `/api/metrics` endpoint (`true`/`false`) | `true` |
| `METRICS_SECRET` | Bearer token required to scrape the endpoint | `a-long-random-string` |

**Metrics exposed:**

| Metric name | Type | Labels |
|-------------|------|--------|
| `http_requests_total` | Counter | `method`, `route`, `status_class` |
| `http_request_duration_seconds` | Histogram | `method`, `route` |
| `errors_total` | Counter | `category`, `severity` |
| `unhandled_rejections_total` | Counter | — |
| `uncaught_exceptions_total` | Counter | — |
| `db_query_duration_seconds` | Histogram | `model`, `operation`, `status` |
| `db_connection_pool_active` | Gauge | — |
| `db_connection_pool_idle` | Gauge | — |
| `db_connection_pool_max` | Gauge | — |
| `app_uptime_seconds` | Gauge | — |

**Verify it's working:**
```bash
curl -H "Authorization: Bearer <METRICS_SECRET>" https://your-app.com/api/metrics
# Should return Prometheus text format starting with # HELP ...
```

---

## Option A — Grafana Cloud (recommended, free tier available)

Grafana Cloud has a hosted Prometheus that can remote-write from your app. This is the simplest option — no servers to manage.

### Step 1 — Create a Grafana Cloud account

1. Go to [grafana.com/auth/sign-up](https://grafana.com/auth/sign-up)
2. Create a free stack (includes 10k metrics series, 50GB logs, 14-day retention)
3. Note your **stack slug** (e.g. `your-app`)

### Step 2 — Get your Prometheus remote-write credentials

1. Grafana Cloud → Your stack → **Prometheus** tile → **Details**
2. Note:
   - **Remote Write URL:** `https://prometheus-prod-xx-prod-xx.grafana.net/api/prom/push`
   - **Username** (numeric ID, e.g. `123456`)
   - **Password** → Generate an API key with **MetricsPublisher** role

### Step 3 — Set up a Grafana Agent to scrape your app

Grafana Agent runs as a sidecar/standalone process that scrapes `/api/metrics` and remote-writes to Grafana Cloud.

**Option 3a — Run Grafana Agent on Railway (recommended)**

Add a second Railway service to your project:

1. Railway Dashboard → New Service → Docker image → `grafana/agent:latest`
2. Set the following environment variables in that service:

```
AGENT_CONFIG_PATH=/etc/agent/config.river
```

3. Add a config file via a Docker volume or use the inline env var approach below.

Create `grafana-agent-config.river` (or set as `AGENT_CONFIG` env var):

```hcl
prometheus.scrape "your_app_db" {
  targets = [{
    __address__ = "your-app.railway.internal:3000",
  }]

  metrics_path    = "/api/metrics"
  scrape_interval = "15s"

  authorization {
    type        = "Bearer"
    credentials = env("METRICS_SECRET")
  }

  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_REMOTE_WRITE_URL")

    basic_auth {
      username = env("GRAFANA_METRICS_USERNAME")
      password = env("GRAFANA_METRICS_PASSWORD")
    }
  }
}
```

Set these env vars on the Grafana Agent service in Railway:

| Variable | Value |
|----------|-------|
| `METRICS_SECRET` | Same value as your app's `METRICS_SECRET` |
| `GRAFANA_REMOTE_WRITE_URL` | From Step 2 |
| `GRAFANA_METRICS_USERNAME` | From Step 2 |
| `GRAFANA_METRICS_PASSWORD` | API key from Step 2 |

**Option 3b — Run Grafana Agent locally (for testing)**

```bash
# Install
brew install grafana-agent          # macOS
# or download from grafana.com/docs/agent/latest/

# Create config.river
cat > /tmp/agent-config.river <<'EOF'
prometheus.scrape "your-app" {
  targets = [{ __address__ = "your-app.com" }]
  metrics_path    = "/api/metrics"
  scheme          = "https"
  scrape_interval = "15s"
  authorization {
    type        = "Bearer"
    credentials = "<YOUR_METRICS_SECRET>"
  }
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = "<GRAFANA_REMOTE_WRITE_URL>"
    basic_auth {
      username = "<GRAFANA_METRICS_USERNAME>"
      password = "<GRAFANA_METRICS_PASSWORD>"
    }
  }
}
EOF

# Run
grafana-agent run /tmp/agent-config.river
```

### Step 4 — Verify metrics are arriving

1. Grafana Cloud → Explore → Select **Prometheus** datasource
2. Run query: `http_requests_total`
3. You should see data within 30 seconds of the first scrape

---

## Option B — Self-Hosted Prometheus + Grafana (Docker Compose)

Use this if you want full control or already run your own monitoring stack.

### Step 1 — Create `docker-compose.monitoring.yml`

```yaml
version: "3.9"

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.retention.time=13mo"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=changeme
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

### Step 2 — Create `prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: your-app
    scheme: https
    metrics_path: /api/metrics
    static_configs:
      - targets:
          - your-app.com
    authorization:
      type: Bearer
      credentials: <YOUR_METRICS_SECRET>
    tls_config:
      insecure_skip_verify: false
```

### Step 3 — Start the stack

```bash
docker compose -f docker-compose.monitoring.yml up -d

# Verify Prometheus is scraping
open http://localhost:9090/targets
# your-app should show state=UP
```

### Step 4 — Add Prometheus datasource in Grafana

1. Open [http://localhost:3001](http://localhost:3001) (admin / changeme)
2. **Connections → Data sources → Add new → Prometheus**
3. URL: `http://prometheus:9090`
4. Click **Save & Test** → should say "Data source is working"

---

## Step 5 — Import the Grafana Dashboard

Create a new dashboard with these panels (or import via JSON):

### Panel 1 — Request Rate
```
rate(http_requests_total[5m])
```
Legend: `{{method}} {{route}} {{status_class}}`

### Panel 2 — Error Rate
```
rate(http_requests_total{status_class="5xx"}[5m])
/
rate(http_requests_total[5m])
```
Unit: `percent (0-1)` — Alert threshold: > 0.05 (5%)

### Panel 3 — p95 Latency
```
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)
```
Unit: `seconds` — Alert threshold: > 3s

### Panel 4 — p50 Latency (median)
```
histogram_quantile(0.50,
  rate(http_request_duration_seconds_bucket[5m])
)
```

### Panel 5 — DB Query Rate
```
rate(db_query_duration_seconds_count[5m])
```
Legend: `{{model}} {{operation}}`

### Panel 6 — DB p95 Query Latency
```
histogram_quantile(0.95,
  rate(db_query_duration_seconds_bucket[5m])
)
```
Unit: `seconds` — Alert threshold: > 2s

### Panel 7 — Error Count
```
rate(errors_total[5m])
```
Legend: `{{category}} {{severity}}`

### Panel 8 — App Uptime
```
app_uptime_seconds
```
Unit: `seconds (s)`

### Panel 9 — DB Connection Pool
```
db_connection_pool_active
db_connection_pool_idle
db_connection_pool_max
```

---

## Step 6 — Set Up Prometheus Alerting Rules

Create `alerts.yml` and reference it from `prometheus.yml`:

```yaml
# prometheus.yml — add this section:
rule_files:
  - /etc/prometheus/alerts.yml
```

```yaml
# alerts.yml
groups:
  - name: your-app
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status_class="5xx"}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP error rate ({{ $value | humanizePercentage }})"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p95 latency above 3s ({{ $value }}s)"

      - alert: SlowDbQueries
        expr: |
          histogram_quantile(0.95,
            rate(db_query_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p95 DB query latency above 2s"

      - alert: AppDown
        expr: up{job="your-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "YourApp app is not being scraped"
```

---

## Step 7 — Wire Alerts to Slack (optional)

In `prometheus.yml` add an Alertmanager config, or use Grafana's built-in alerting:

1. Grafana → Alerting → Contact points → New → Slack
2. Paste your Slack webhook URL
3. Assign to alert rules from Step 6

---

## Environment Variables Summary

Add these to Railway Dashboard → App service → Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `METRICS_ENABLED` | `true` | Yes |
| `METRICS_SECRET` | `openssl rand -hex 32` | Yes — protects the endpoint |

> **Note:** There's a typo in `example.env` — it says `METRICS_SERCRET`. The correct variable name is `METRICS_SECRET`.

---

## See Also

- `alerting.md` — full alert threshold reference
- `infrastructure-monitoring.md` — Railway built-in metrics
- `observability-error-monitoring.md` — Sentry error tracking
