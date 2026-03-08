# Infrastructure Monitoring

**Item 56 — Feb 21, 2026**

Covers CPU, memory, disk, network, and Redis monitoring.

---

## Current Metrics Coverage

| Metric | Status | Source |
|--------|--------|--------|
| HTTP request rate | ✅ | `/api/metrics` (Prometheus) |
| HTTP error rate | ✅ | `/api/metrics` (Prometheus) |
| HTTP latency (p50, p95, p99) | ✅ | `/api/metrics` (Prometheus) |
| DB query count | ✅ | `/api/metrics` (Prometheus) |
| App health | ✅ | `/api/health` |
| CPU usage | ⚠️ Via Railway | Railway Dashboard → Observability |
| Memory usage | ⚠️ Via Railway | Railway Dashboard → Observability |
| Disk usage | ⚠️ Via Railway | Railway Dashboard → Observability |
| Network I/O | ⚠️ Via Railway | Railway Dashboard → Observability |
| Redis memory/connections | ⚠️ Via Railway | Railway Dashboard → Redis service metrics |

---

## Railway Built-In Monitoring

Railway Pro provides per-service metrics out of the box:

1. Railway Dashboard → Your Project → App service → Metrics
2. View: CPU %, Memory MB, Network In/Out, Disk I/O
3. **Set up alerts:** Metrics → Alerts → Add rule (CPU > 80%, Memory > 85%)

### Redis Metrics

Railway Dashboard → Redis service → Metrics:
- **Used Memory:** Should stay below 80% of allocated memory
- **Connected Clients:** Spikes indicate a connection leak
- **Keyspace Hits/Misses:** Low hit rate indicates rate limiter cache miss

---

## Prometheus + Grafana (Full Infrastructure Dashboard)

The app exposes `/api/metrics` in Prometheus format (requires `METRICS_SECRET` bearer token).

### Recommended Grafana Dashboard Panels

**Application Performance**
| Panel | Query | Alert threshold |
|-------|-------|----------------|
| Request rate | `rate(http_requests_total[5m])` | — |
| Error rate | `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])` | > 5% |
| p95 latency | `histogram_quantile(0.95, http_request_duration_seconds_bucket)` | > 3s |

**Infrastructure (from Railway metrics or node_exporter)**
| Panel | Metric | Alert threshold |
|-------|--------|----------------|
| CPU usage | `process_cpu_usage` | > 80% for 10 min |
| Memory usage | `process_resident_memory_bytes` | > 85% |
| Node version | `nodejs_version_info` | — |

**Database**
| Panel | Query | Alert |
|-------|-------|-------|
| DB query rate | `rate(db_queries_total[5m])` | — |
| Slow queries | Logged via `pg_stat_statements` | > 2s average |

---

## Redis Monitoring

Add these checks to your monitoring setup:

```bash
# Check Redis memory usage
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human

# Check connected clients
redis-cli -u $REDIS_URL INFO clients | grep connected_clients

# Check keyspace
redis-cli -u $REDIS_URL INFO keyspace
```

---

## Disk Monitoring

Railway PostgreSQL manages disk automatically. Monitor via:
- Railway Dashboard → PostgreSQL service → Storage
- Alert when storage exceeds 80% of provisioned size

---

## See Also

- `alerting.md` — full alert threshold table
- `uptime-monitoring.md` — external uptime checks
- `observability-error-monitoring.md` — Sentry and error tracking
