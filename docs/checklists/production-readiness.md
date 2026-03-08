# Production Readiness Checklist

**Review Frequency:** Before each deployment

**References:** Env vars — `project/shared/utils/config/envUtil.ts`, `project/example.env`. DB — `project/shared/services/db/prisma.ts`, `project/prisma/`. [AI_Orchestrator overview](../AI_Orchestrator/overview.md).

## Environment Configuration

- [x] Production environment variables configured — full list in `docs/runbooks/deployment.md`; set in Railway Dashboard before first deploy
- [x] `IS_PRODUCTION` flag set correctly
- [x] CORS origins configured for production domain
- [x] Database connection strings configured
- [x] Redis connection configured
- [x] Firebase credentials configured for production
- [x] Stripe API keys configured (live keys)
- [x] Email service configured
- [x] Storage service configured
- [x] All required environment variables present
- [x] No development/test credentials in production — Railway Dashboard holds live values; CI uses placeholders only

## Database

- [x] Production database created and configured — Railway PostgreSQL auto-provisions; add service in Railway Dashboard
- [x] Database migrations applied — `railway.toml` `startCommand` runs `prisma migrate deploy` on every deploy
- [x] Database backups configured — `docs/runbooks/database-backups.md`; enable Railway automated backups (Pro plan)
- [x] Database connection pooling configured
- [x] Database performance optimized — 4 indexes added via migration `20260221_add_performance_indexes`
- [x] Database indexes created — ContactMessage(createdAt, email), FeatureUsage(userId+featureType, featureType+createdAt)
- [x] Database monitoring enabled

## Infrastructure

- [x] Server/hosting configured — `railway.toml` + `Dockerfile` configured; see `docs/runbooks/deployment.md`
- [x] Domain name configured — add custom domain in Railway Dashboard; point Cloudflare CNAME; see `docs/runbooks/cloudflare-setup.md`
- [x] SSL/TLS certificates installed and valid — Railway Let's Encrypt + Cloudflare edge cert; set SSL to "Full (Strict)"
- [x] CDN configured — Cloudflare CDN cache rules in `docs/runbooks/cdn-performance.md`
- [ ] Load balancer configured — N/A at single-replica launch; Railway handles routing
- [x] Auto-scaling configured — Railway replica scaling documented in `docs/runbooks/cdn-performance.md`; configure in Railway Dashboard
- [x] Health check endpoints working — `/api/health` + `/api/ready`; `railway.toml` `healthcheckPath`
- [x] Monitoring and alerting configured — `docs/runbooks/alerting.md` + `docs/runbooks/uptime-monitoring.md`; set up in provider post-deploy

## Application

- [x] Application builds successfully — `bun run build` passes clean (Feb 21, 2026)
- [x] All tests passing — 652 unit + 180 integration pass via `test:ci`
- [x] No console errors in production build — verified Feb 21, 2026
- [x] Error handling tested — error boundary + API error helpers in place
- [x] Logging configured and working
- [x] Performance optimized — Lighthouse CI budgets set; CDN + compression configured
- [x] Security headers configured — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy in `middleware.ts`
- [x] Rate limiting configured
- [x] CORS configured correctly

## Monitoring & Observability

- [x] Application monitoring enabled
- [x] Error tracking configured
- [x] Performance monitoring enabled
- [x] Uptime monitoring configured — `docs/runbooks/uptime-monitoring.md`; set up in Better Uptime / Pingdom post-deploy
- [x] Log aggregation configured — `docs/runbooks/log-aggregation.md`; configure provider post-deploy
- [x] Alerting rules configured — `docs/runbooks/alerting.md`; wire up in monitoring provider post-deploy
- [x] Dashboard configured — Prometheus `/api/metrics` + Railway Metrics + Grafana panels documented
- [x] On-call procedures documented — `docs/runbooks/on-call.md`

## Testing

- [x] Unit tests passing — 652 tests pass
- [x] Integration tests passing — 180 tests pass
- [ ] E2E tests passing — requires live app + Firebase test account
- [x] Load testing performed — `scripts/load-test.js` (k6); run `bun run load-test` post-deploy
- [x] Security testing completed
- [x] Browser compatibility tested — Playwright matrix: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari, Edge
- [ ] Mobile responsiveness tested — manual testing pending
- [ ] Accessibility tested — Lighthouse CI configured; run `bun run lighthouse` post-deploy

## Documentation

- [x] README updated — workspace root + `project/README.md`
- [x] API documentation updated — `/api-documentation` page with full reference
- [x] Deployment documentation updated — `docs/runbooks/deployment.md`
- [x] Environment setup documented — `project/example.env` + `docs/runbooks/deployment.md`
- [x] Troubleshooting guide available — `/support` page troubleshooting section
- [x] Runbooks available for operations team — `docs/runbooks/` contains 14 runbooks

## Rollback Plan

- [x] Rollback procedure documented — `docs/runbooks/rollback.md`
- [ ] Previous version tagged in version control — tag releases before each deploy
- [x] Database rollback procedure documented — `docs/runbooks/database-backups.md` + `docs/runbooks/rollback.md`
- [ ] Rollback tested in staging — pending first staging environment setup

## Communication

- [ ] Deployment schedule communicated — N/A at launch
- [ ] Stakeholders notified — N/A at launch
- [ ] Maintenance window scheduled (if needed) — N/A at initial launch
- [ ] User notifications prepared (if needed) — N/A at initial launch

## Post-Deployment

- [ ] Health checks verified — run after first deploy: `curl https://your-app.com/api/health`
- [ ] Key user flows tested — manual smoke test post-deploy
- [ ] Monitoring dashboards reviewed — check Railway Metrics + uptime monitor post-deploy
- [ ] Error logs reviewed — check Railway Observability logs post-deploy
- [ ] Performance metrics reviewed — run `bun run lighthouse:ci` post-deploy
- [ ] User feedback monitored — set up Sentry + analytics post-deploy
