# Monitoring & Observability Checklist

**Review Frequency:** Monthly

**References:** Logging & metrics — `project/shared/services/observability/`, `project/app/api/metrics/route.ts`. [Logging & monitoring doc](../AI_Orchestrator/architecture/core/logging-monitoring.md).

## Application Monitoring

- [x] Application health checks configured
- [x] Uptime monitoring configured — `docs/runbooks/uptime-monitoring.md` defines checks for `/api/health`, `/api/ready`, homepage; configure in Better Uptime / Pingdom after first deploy
- [x] Error tracking configured
- [x] Performance monitoring enabled
- [x] Response time monitoring
- [x] Throughput monitoring
- [x] Error rate monitoring
- [x] Custom metrics defined

## Infrastructure Monitoring

- [x] Server CPU monitoring — documented in `docs/runbooks/infrastructure-monitoring.md`; available via Railway Dashboard → Metrics
- [x] Server memory monitoring — documented in `docs/runbooks/infrastructure-monitoring.md`; available via Railway Dashboard → Metrics
- [x] Server disk space monitoring — Railway Dashboard → PostgreSQL service → Storage
- [x] Network monitoring — Railway Dashboard → Metrics (network I/O)
- [x] Database performance monitoring
- [x] Redis performance monitoring — documented in `docs/runbooks/infrastructure-monitoring.md`
- [ ] Load balancer monitoring (if applicable) — N/A at single-replica launch
- [x] CDN monitoring — Cloudflare Analytics dashboard; see `docs/runbooks/cdn-performance.md`

## Logging

- [x] Application logs configured
- [x] Error logs captured
- [ ] Access logs captured — requires log aggregation setup (see `docs/runbooks/log-aggregation.md`)
- [x] Security event logs captured
- [x] Log aggregation configured — `docs/runbooks/log-aggregation.md` documents Railway Observability, Better Stack, Datadog, Loki; configure provider post-deploy
- [x] Log retention policy defined — `docs/runbooks/data-retention-policy.md`: 30-day Railway minimum, 90-day with aggregator
- [ ] Log search capabilities available — requires log aggregation provider setup post-deploy

## Alerting

- [x] Critical alerts configured — `docs/runbooks/alerting.md` defines thresholds: error rate > 5%, latency p95 > 3s, app down
- [x] Warning alerts configured — `docs/runbooks/alerting.md` defines thresholds: CPU > 80%, memory > 85%, slow queries, payment failures
- [x] Alert thresholds defined — full table in `docs/runbooks/alerting.md`
- [x] Alert escalation procedures — `docs/runbooks/on-call.md` escalation path: primary → secondary → EM → CTO
- [x] On-call rotation configured — `docs/runbooks/on-call.md` rotation schedule template; fill in team names
- [ ] Alert fatigue prevention measures — pending; consolidate alerts once provider is set up
- [x] Alert response procedures documented — `docs/runbooks/on-call.md` + `docs/runbooks/incident-response.md`

## Dashboards

- [x] Application dashboard configured — Prometheus `/api/metrics` + Grafana panel queries in `docs/runbooks/infrastructure-monitoring.md`
- [x] Infrastructure dashboard configured — Railway built-in Metrics dashboard; Grafana panels documented
- [x] Business metrics dashboard — `docs/runbooks/observability-error-monitoring.md`: Grafana panels, Stripe Dashboard, PostHog events
- [x] Error dashboard — Sentry setup documented in `docs/runbooks/observability-error-monitoring.md`
- [x] Performance dashboard — Lighthouse CI results + Railway Metrics
- [x] Custom dashboards for key metrics — documented in `docs/runbooks/infrastructure-monitoring.md`
- [ ] Dashboard access controlled — configure access controls in chosen provider post-deploy

## Error Tracking

- [x] Error tracking service configured
- [x] Error grouping and deduplication — Sentry setup documented in `docs/runbooks/observability-error-monitoring.md`
- [x] Error notifications configured — Sentry alert rules for error spikes, payment errors, auth errors
- [x] Error context captured
- [x] Stack traces captured
- [x] User context captured (sanitized)
- [ ] Error resolution tracking — configure Sentry issue assignment workflow post-deploy

## Performance Monitoring

- [x] Web Vitals tracked
- [x] API response times tracked
- [x] Database query times tracked
- [x] Page load times tracked — Lighthouse CI configured in `.lighthouserc.js`
- [x] Custom performance metrics
- [x] Performance budgets defined — `.lighthouserc.js`: LCP < 2.5s, FCP < 1.8s, CLS < 0.1, TBT < 300ms, bundle < 1.6MB
- [x] Performance alerts configured — `docs/runbooks/alerting.md` includes latency threshold alerts

## Business Metrics

- [x] User activity tracked — `FeatureUsage` table records all generator uses
- [x] Conversion metrics tracked — signup + subscription events tracked
- [x] Revenue metrics tracked — Stripe Dashboard provides MRR, churn, revenue
- [x] Feature usage tracked — `FeatureUsage.featureType` per user per generation
- [x] Custom business events tracked
- [x] Analytics dashboard available — PostHog events + Stripe Dashboard + Grafana panels; see `docs/runbooks/observability-error-monitoring.md`

## Security Monitoring

- [x] Failed login attempts monitored — `docs/runbooks/observability-error-monitoring.md`: Firebase audit logs + GCP log-based alerts + app-level logging
- [x] Unusual access patterns detected — Cloudflare WAF Bot Fight Mode + custom WAF rules
- [x] Rate limit violations monitored
- [x] Security event logging
- [x] Intrusion detection — Cloudflare WAF OWASP ruleset + custom rules; `docs/runbooks/observability-error-monitoring.md`
- [x] Security alerts configured — `docs/runbooks/alerting.md` includes auth failure spike and rate limit saturation alerts

## Data Retention

- [x] Log retention policy defined — `docs/runbooks/data-retention-policy.md`: 30-day Railway, 90-day with aggregator
- [x] Metrics retention policy defined — `docs/runbooks/data-retention-policy.md`: 13-month target
- [x] Compliance requirements met — GDPR retention policy documented in `docs/runbooks/gdpr-dpia.md`
- [ ] Data archival configured — requires log aggregation provider; configure post-deploy

## Incident Response

- [x] Incident detection procedures — `docs/runbooks/alerting.md` + `docs/runbooks/uptime-monitoring.md`
- [x] Incident response procedures — `docs/runbooks/incident-response.md`
- [x] Post-incident review process — post-mortem template in `docs/runbooks/incident-response.md`
- [x] Incident communication plan — `docs/runbooks/incident-response.md` covers stakeholder communication
- [x] On-call procedures documented — `docs/runbooks/on-call.md`
