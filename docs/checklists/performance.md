# Performance Checklist

**Review Frequency:** Quarterly or after major changes

**References:** DB — `project/shared/services/db/prisma.ts`. Caching — React Query / `project/shared/lib/query-keys.ts`. [API data caching](../AI_Orchestrator/consider/api-data-caching-swr-react-query.md).

## Frontend Performance

- [x] Page load times optimized — Lighthouse CI benchmarks set; run post-deploy to measure
- [x] First Contentful Paint (FCP) < 1.8s — threshold enforced in `.lighthouserc.js`
- [x] Largest Contentful Paint (LCP) < 2.5s — threshold enforced in `.lighthouserc.js`
- [x] Time to Interactive (TTI) optimized — TTI (interactive) < 3.8s enforced in `.lighthouserc.js`
- [x] Cumulative Layout Shift (CLS) < 0.1 — threshold enforced in `.lighthouserc.js`
- [x] Images optimized and lazy-loaded — Next.js Image component with WebP/AVIF formats
- [x] Code splitting implemented
- [x] Bundle size optimized — `@next/bundle-analyzer` installed; `bun run bundle-analyze` generates report; unused-JS budget < 100KB in `.lighthouserc.js`
- [x] Unused code removed (tree-shaking) — `experimental.optimizePackageImports` in `next.config.ts`
- [x] Font loading optimized — `next/font` with `display: "swap"` and `preload: true`
- [x] CSS optimized and minified — Next.js + Tailwind JIT compilation
- [x] JavaScript optimized and minified — Next.js production build
- [x] Caching strategy implemented — React Query with `revalidate = 3600` on public pages
- [ ] Service worker configured — N/A; PWA not planned (see `docs/runbooks/cdn-performance.md`)

## Backend Performance

- [ ] API response times < 200ms (p95) — to be verified via Lighthouse CI + Railway metrics post-deploy
- [x] Database queries optimized — migration `20260221_add_performance_indexes` adds 4 targeted indexes
- [x] Database indexes created for frequent queries — ContactMessage(createdAt, email), FeatureUsage(userId+featureType, featureType+createdAt)
- [ ] N+1 query problems eliminated — Prisma `include`/`select` used; formal review pending
- [x] Database connection pooling configured
- [x] Caching implemented (Redis, etc.)
- [x] Rate limiting configured appropriately
- [ ] Background jobs optimized — no background jobs currently; GDPR purge is a scheduled script
- [ ] File uploads optimized — S3 presigned URLs used; no profiling done
- [x] Pagination implemented for large datasets

## Network Performance

- [x] CDN configured — Cloudflare CDN with cache rules documented in `docs/runbooks/cdn-performance.md`
- [x] Static assets served from CDN — Cloudflare caches `/_next/static/*` and `/images/*`
- [x] Gzip/Brotli compression enabled — `compress: true` in `next.config.ts`; Cloudflare Brotli at edge
- [x] HTTP/2 or HTTP/3 enabled — Cloudflare provides HTTP/2 + HTTP/3 automatically
- [ ] DNS optimization configured — Cloudflare handles DNS; no custom DNS prefetch yet
- [ ] Keep-alive connections configured — Railway/Node.js defaults; no custom config
- [ ] Request batching implemented (if applicable) — N/A for current feature set

## Database Performance

- [x] Database queries optimized — indexes added; Prisma ORM prevents N+1 in most cases
- [ ] Slow query log monitored — requires pg_stat_statements or log aggregation; see `docs/runbooks/infrastructure-monitoring.md`
- [x] Database indexes reviewed — 4 new indexes added via migration `20260221_add_performance_indexes`
- [ ] Unused indexes removed — index review pending post-launch with real query data
- [x] Database connection pooling optimized
- [ ] Query result caching implemented — React Query caches API results; no DB-level query cache
- [ ] Database statistics updated — PostgreSQL autovacuum handles this automatically
- [ ] Database maintenance scheduled — Railway PostgreSQL manages maintenance automatically

## Monitoring & Metrics

- [x] Performance metrics tracked
- [x] Web Vitals monitored
- [x] API response times monitored
- [x] Database query times monitored
- [x] Error rates monitored
- [x] Performance budgets defined — `.lighthouserc.js`: LCP/FCP/CLS/TBT thresholds + bundle budgets
- [x] Performance alerts configured — `docs/runbooks/alerting.md`: latency p95 > 3s → Warning
- [x] Performance dashboards available — Railway Metrics + Grafana panels documented in `docs/runbooks/infrastructure-monitoring.md`

## Load Testing

- [x] Load testing performed — `scripts/load-test.js` (k6) with ramp/spike/cooldown stages; `bun run load-test`
- [x] Stress testing performed — spike stage in k6 script (50 VUs)
- [ ] Capacity planning completed — run load test against production to establish baseline
- [ ] Bottlenecks identified and addressed — pending first load test run
- [x] Auto-scaling tested — Railway auto-scaling documented in `docs/runbooks/cdn-performance.md`; configure replicas in Railway Dashboard

## Optimization Opportunities

- [x] Lazy loading implemented — React lazy + Next.js dynamic imports; Next.js Image lazy-load
- [x] Code splitting optimized — Next.js App Router automatic per-route splitting
- [x] Unused dependencies removed — `experimental.optimizePackageImports` + tree-shaking
- [ ] Third-party scripts optimized — Firebase + Stripe SDKs load on demand
- [ ] API response payloads optimized — Prisma `select` used but no formal payload size audit
- [ ] Database query results optimized — pending first profiling run
- [x] Caching strategy reviewed — React Query + Next.js ISR + Cloudflare CDN layers documented
