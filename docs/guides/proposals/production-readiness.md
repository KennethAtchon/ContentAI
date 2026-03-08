# Production Readiness Checklist

A comprehensive checklist of items that MUST be completed before launching **this template (or your product)** to production. The template provides many building blocks; production launch requires completing environment setup, security verification, backups, and monitoring for your deployment.

**Last updated:** February 2026 (scan of codebase).

### Already in the template (verify for your env)

- **Security:** Centralized env (envUtil), rate limiting (all endpoints), CSRF, CORS, API protection (auth/admin/public), input validation (Zod), PII sanitization in logs.
- **Health:** `/api/health` (DB, Redis, service, DB perf), `/api/ready` (readiness probe).
- **Error handling:** Global error handler, API protection wrapper (catches and returns 500 with generic message).
- **Observability:** Structured logging (debugLog), Web Vitals reporter and API route, optional Firebase logging; error metrics endpoint.
- **Legal/Support:** Terms and Privacy pages (customize copy), contact form and admin contact messages, support email from app.constants; delete-account API (GDPR-style anonymization).
- **Email:** Resend integration, order confirmation template with app name/support placeholders.
- **Testing/quality:** Jest, Playwright scripts, ESLint, Prettier, TypeScript strict.

---

## 1. Observability & Monitoring

**Status:** ⚠️ Partial – structured logging and Web Vitals in place; app metrics and alerting are adopters’ responsibility.

### Logs and Metrics
- [x] **Set up centralized logging system**
  - Configure Firebase/Cloud Logging or alternative (Datadog, Sentry, LogRocket) ✅
  - Implement structured logging with correlation IDs ✅
  - Set log levels appropriately (info, warn, error, debug) ✅
  - Ensure sensitive data (passwords, tokens) is never logged ✅
  - **In codebase:** `project/shared/services/observability/firebase-logging.ts`, `project/shared/utils/debug/` (PII sanitized in logs)
  - **Note:** Optional package `@google-cloud/logging` for Firebase logging; host (e.g. Railway) may provide built-in logs.

- [ ] **Application metrics collection**
  - Response times and latency tracking
  - Request rates and throughput
  - Error rates by endpoint
  - Database query performance
  - Redis cache hit/miss rates
  - API endpoint usage statistics
  - **In codebase:** `project/app/api/health/error-monitoring/route.ts` (error metrics); DB performance monitor in `project/shared/services/db/performance-monitor.ts`. Full app metrics are not built in.

- [ ] **Real-time alerting**
  - Set up alerts for error rate spikes (>1% error rate)
  - Alert on high latency (>2s p95)
  - Alert on database connection failures
  - Alert on payment processing failures (Stripe webhook failures)
  - Alert on critical service outages (Firebase, Redis)
  - **Template:** No built-in alerting; configure in your host or use Sentry/Datadog etc.

- [ ] **User analytics**
  - Track user actions and feature usage
  - Monitor conversion funnel (signup → subscription)
  - Track core feature usage patterns
  - Monitor subscription churn indicators
  - **In codebase:** Feature usage stored in `FeatureUsage`; analytics routes in `app/api/analytics/` (web-vitals, form-completion, search-performance). Product analytics (e.g. conversion funnel) is adopter’s to add.

- [x] **Performance monitoring (Web Vitals)**
  - Web Vitals tracking (LCP, FID, CLS, FCP, TTFB) ✅
  - **In codebase:** `project/shared/components/analytics/web-vitals-reporter.tsx`, `project/shared/utils/system/web-vitals.ts`, `project/app/api/analytics/web-vitals/route.ts`
  - [ ] Core Web Vitals dashboard / RUM: adopters set up (e.g. Vercel Analytics, Sentry)

---

## 2. Infrastructure & Scaling

**Status:** ⚠️ Template is host-agnostic (Railway, Render, Fly.io, AWS, etc.). Verify configuration for your chosen host.

### Current Infrastructure (your host)
- [ ] **Verify production configuration**
  - Ensure production environment variables are set
  - Configure resource limits (CPU, memory)
  - Set up auto-scaling rules (if available)
  - Configure health check endpoints
  - **In codebase:** `/api/health` (full: DB, Redis, service, DB perf), `/api/ready` (readiness probe for load balancers/K8s). Point your host at these.
  - Set up host monitoring and alerts

- [ ] **Database scaling preparation**
  - Verify PostgreSQL connection pooling is configured
  - Set up database read replicas (if needed)
  - Configure connection limits
  - Monitor database size and plan for growth
  - Set up database backups (automated daily backups)

- [ ] **Redis configuration**
  - Verify Redis persistence settings
  - Configure Redis memory limits
  - Set up Redis monitoring
  - Plan for Redis failover/high availability

### Migration / alternative hosts
- [ ] **Host strategy**
  - Document deployment target (Railway, Render, Fly.io, AWS, Vercel, etc.)
  - Identify services needed: PostgreSQL, Redis, object storage (optional, e.g. R2/S3)
  - **In codebase:** `docker-compose.yml` for local Postgres + Redis; production uses env vars (DATABASE_URL, REDIS_URL, etc.)
  - Plan backup, scaling, and rollback for your host

---

## 3. Security

### Authentication & Authorization
- [ ] **Firebase Auth security**
  - Verify production Firebase project is separate from dev
  - Enable email verification requirement
  - Configure password strength requirements
  - Set up account lockout after failed attempts
  - Enable 2FA/MFA (if applicable)
  - Review Firebase security rules

- [x] **API security (structure in place)**
  - Verify all API routes have authentication checks ✅ (adopters: audit routes)
  - Ensure admin routes require admin role verification ✅
  - Test CSRF protection is working ✅
  - Verify rate limiting is enabled on all public endpoints ✅
  - **In codebase:** All API routes use `withUserProtection`, `withAdminProtection`, or `withPublicProtection` from `project/shared/middleware/api-route-protection.ts` (CORS, rate limit, CSRF, auth). Rate limits in `project/shared/constants/rate-limit.config.ts`. Review and test authorization logic before launch.

### Data Protection
- [x] **Secrets management (pattern in place)**
  - Verify all secrets are in environment variables (never in code) ✅
  - **In codebase:** All env access via `project/shared/utils/config/envUtil.ts`; no `process.env` in app code. `.env.example` has placeholders only.
  - [ ] Use secure secret management in production (host secrets, AWS Secrets Manager, etc.)
  - [ ] Rotate all API keys and secrets before production
  - [ ] Never commit `.env`; verify `.env.example` has no real secrets

- [ ] **Encryption**
  - Verify `ENCRYPTION_KEY` is set and secure (32+ characters)
  - Test encryption/decryption of sensitive data
  - Ensure HTTPS/TLS is enforced everywhere
  - Verify database connections use SSL

- [x] **Input validation**
  - Verify all user inputs are validated (Zod schemas) ✅
  - Test SQL injection prevention (Prisma handles this, but verify) ✅
  - Test XSS prevention ✅
  - Verify file upload validation and sanitization ✅
  - **Tests created:** `project/__tests__/unit/validation/input-validation.test.ts`
  - **Auth validation added:** `project/shared/utils/validation/auth-validation.ts`

### Network Security
- [x] **CORS configuration (dynamic)**
  - **In codebase:** CORS validated in middleware and api-route-protection via `CORS_ALLOWED_ORIGINS` from env. Defaults in envUtil: localhost and example.com.
  - [ ] Verify production `CORS_ALLOWED_ORIGINS` only includes your production domain(s); remove localhost in production.

- [ ] **Headers security**
  - **In codebase:** `next.config.ts` has `poweredByHeader: false`; security headers added per-route in `addSecurityHeaders` (api-route-protection).
  - [ ] Configure CSP, HSTS, X-Frame-Options if required (add in next.config `headers()` or middleware). Test with security header checker tools.

- [x] **DDoS protection**
  - Configure rate limiting on all endpoints ✅
  - Set up DDoS protection (Railway/Cloudflare/AWS Shield) - Railway provides basic DDoS protection
  - Monitor for unusual traffic patterns ✅
  - **Rate limit config created:** `project/shared/constants/rate-limit.config.ts` with TPS calculations
  - **All endpoints have rate limiting configured with TPS metrics**

---

## 4. Database & Data Management

### Database Migrations
- [ ] **Migration strategy**
  - Verify all migrations are tested in staging
  - **In codebase:** `bun run db:deploy` (Prisma migrate deploy) for production. Schema in `project/infrastructure/database/prisma/schema.prisma`.
  - Document rollback procedures for each migration
  - Test migration rollback in staging environment

- [ ] **Database backups**
  - Set up automated daily backups
  - Test backup restoration process
  - Configure backup retention policy (30+ days)
  - Store backups in separate location/region
  - Document backup restoration procedure

- [ ] **Database performance**
  - Review and optimize slow queries
  - Add database indexes where needed
  - Configure connection pooling (Prisma connection pool)
  - Set up query performance monitoring
  - Plan for database scaling (vertical/horizontal)

- [ ] **Data integrity**
  - Verify foreign key constraints are in place
  - Test data validation at database level
  - Set up data retention policies (GDPR compliance)
  - Plan for data archival strategy

---

## 5. Error Handling & Resilience

### Error Handling
- [x] **Global error handling (structure in place)**
  - **In codebase:** `project/shared/utils/error-handling/global-error-handler.ts` (reportError, error categories); `project/shared/utils/error-handling/api-error-wrapper.ts` (withApiErrorHandling, withStandardErrorHandling). API routes use `withUserProtection`/`withAdminProtection`/`withPublicProtection`, which catch errors and return 500 with generic message (see api-route-protection.ts try/catch).
  - [ ] Verify error boundaries in app (Next.js app router: add `error.tsx` / `global-error.tsx` if needed for UI).
  - [ ] Verify errors are logged but not exposed to users (sensitive data sanitized in debugLog).

- [ ] **Error tracking**
  - Set up error tracking service (Sentry, Rollbar, etc.)
  - Configure error alerts for critical errors
  - Test error reporting is working
  - Set up error grouping and deduplication

- [ ] **User-friendly error messages**
  - Replace technical error messages with user-friendly ones where needed
  - Test error messages in production-like environment
  - Ensure sensitive information is never exposed in errors

### Resilience
- [ ] **Circuit breakers**
  - Implement circuit breakers for external services (Stripe, Firebase, etc.) if needed
  - Test service degradation gracefully
  - Set up fallback mechanisms

- [ ] **Retry logic**
  - Configure retry logic for transient failures (e.g. Stripe, Firebase)
  - Set exponential backoff for retries
  - Test retry behavior under failure conditions

- [x] **Health checks**
  - Verify `/api/health` endpoint is working ✅
  - Test health check includes all critical services (DB, Redis, etc.) ✅
  - **In codebase:** `project/app/api/health/route.ts` (DB, Redis, service, DB performance); `project/app/api/ready/route.ts` (readiness for load balancers/K8s).
  - [ ] Set up health check monitoring in your host
  - [ ] Configure automated restarts on health check failures

---

## 6. Payment Processing (Stripe)

### Stripe Configuration
- [ ] **Production Stripe account**
  - Switch from test mode to live mode
  - Verify live API keys are in production environment
  - Test payment processing with real cards (small amounts)
  - Verify webhook endpoints are configured correctly

- [ ] **Webhook security**
  - Verify `STRIPE_WEBHOOK_SECRET` is set and validated
  - Test webhook signature verification
  - Set up webhook retry handling
  - Monitor webhook delivery success rates

- [ ] **Subscription management**
  - Test subscription creation flow end-to-end
  - Test subscription cancellation
  - Test subscription upgrades/downgrades
  - Verify proration calculations are correct
  - Test subscription renewal process

- [ ] **Payment security**
  - Verify PCI compliance (Stripe handles this)
  - Test 3D Secure (SCA) requirements
  - Verify payment method validation
  - Test refund processing

---

## 7. Performance Optimization

### Frontend Performance
- [ ] **Next.js optimization**
  - **In codebase:** `next.config.ts` has `optimizePackageImports` for lucide-react, radix, framer-motion, recharts; image formats (webp, avif); compression.
  - Verify static generation is used where possible
  - Test ISR (Incremental Static Regeneration) settings
  - Optimize images (Next.js Image component)
  - Verify code splitting is working
  - Test bundle size and optimize if needed

- [ ] **Caching strategy**
  - Configure Redis caching for API responses
  - Set appropriate cache TTLs
  - Test cache invalidation logic
  - Verify CDN caching for static assets

- [ ] **Database query optimization**
  - Review N+1 query problems
  - Optimize database queries with proper indexes
  - Use Prisma query optimization features
  - Monitor slow query logs

- [ ] **API performance**
  - Test API response times
  - Optimize slow endpoints
  - Implement request batching where applicable
  - Test concurrent request handling

---

## 8. Testing

### Test Coverage
- [ ] **Unit tests**
  - **In codebase:** Jest configured; `bun run test` / `test:unit` / `test:coverage`; `__tests__/unit/` (e.g. validation tests).
  - Achieve minimum 70% code coverage (adopter target)
  - Test critical business logic (core feature, payment logic)
  - Run tests in CI/CD pipeline

- [ ] **Integration tests**
  - Test API endpoints end-to-end
  - Test database operations
  - Test external service integrations (Stripe, Firebase)
  - Test authentication flows

- [ ] **E2E tests**
  - **In codebase:** Playwright available (`test:e2e`, `playwright:install`).
  - Test critical user flows (signup, subscription, core feature usage)
  - Test payment checkout flow
  - Test admin dashboard functionality
  - Run E2E tests before production deployments

- [ ] **Load testing**
  - Perform load testing on critical endpoints
  - Test database under load
  - Identify bottlenecks and optimize
  - Set up performance benchmarks

---

## 9. CI/CD Pipeline

### Continuous Integration
- [ ] **Automated testing**
  - Run tests on every PR (`bun run test`, `bun run test:ci`)
  - Block merges if tests fail
  - Run linter and type checking (`bun run lint`, `bunx tsc --noEmit`)
  - Run security scanning (npm audit, Snyk, etc.)
  - **In codebase:** Scripts in package.json; no CI config committed (adopter adds GitHub Actions, etc.).

- [x] **Code quality (tooling in place)**
  - Enforce code formatting (Prettier) ✅ – `format`, `format:check`
  - Run ESLint on all code ✅ – `lint`
  - Enforce TypeScript strict mode ✅ – tsconfig
  - [ ] Set up pre-commit hooks (Husky) – adopter’s choice

### Continuous Deployment
- [ ] **Deployment automation**
  - Set up automated deployments from main branch
  - Configure staging environment
  - Test deployment process multiple times
  - Set up deployment notifications

- [ ] **Deployment safety**
  - Implement blue-green or canary deployments
  - Set up automatic rollback on health check failures
  - Test rollback procedure
  - Document deployment runbook

---

## 10. Environment Configuration

### Environment Variables
- [ ] **Production environment**
  - **In codebase:** `.env.example` in project root with all required vars and comments; `project/shared/utils/config/envUtil.ts` is the single source for reading env (no raw process.env in app code).
  - Verify all required environment variables are set for production
  - Remove all test/development values
  - Verify no placeholder values remain

- [ ] **Environment separation**
  - Ensure production uses separate Firebase project
  - Use separate Stripe account (or at least separate keys)
  - Use separate database instance
  - Use separate Redis instance

- [ ] **Build-time variables**
  - Verify all `NEXT_PUBLIC_*` variables are set correctly
  - Test build succeeds with production variables (`bun run build`)
  - Verify Dockerfile build args are configured if using Docker

---

## 11. Legal & Compliance

### Terms & Policies
- [ ] **Terms of Service**
  - **In codebase:** Terms page at `app/(public)/terms/page.tsx`; content from translations. Customize for your product and get legal review.
  - Link Terms of Service in footer and signup flow ✅ (footer links exist)
  - Get legal review if handling financial data

- [ ] **Privacy Policy**
  - **In codebase:** Privacy page at `app/(public)/privacy/page.tsx`; content from translations. Customize for your product.
  - Document all data collection and usage
  - Comply with GDPR (if serving EU users) / CCPA (if California)
  - Link Privacy Policy in footer and signup ✅

- [ ] **Cookie Policy**
  - Document cookie usage
  - Implement cookie consent banner (if required)
  - Link Cookie Policy in footer

### Data Protection
- [ ] **GDPR compliance** (if applicable)
  - [ ] Implement user data export functionality (template: no dedicated “export my data” API; privacy copy mentions “Export your data” – implement endpoint if required)
  - [x] Implement user data deletion functionality ✅ – **In codebase:** `project/app/api/users/delete-account/route.ts` (anonymizes user data for GDPR)
  - [ ] Document data processing activities
  - [ ] Set up data breach notification procedures

- [ ] **Data retention**
  - Define data retention policies
  - Implement automatic data deletion for inactive accounts (if required)
  - Document data archival procedures

---

## 12. Documentation

### Technical Documentation
- [ ] **API documentation**
  - **In codebase:** `app/(public)/api-documentation/page.tsx` is a placeholder. Document endpoints (or use OpenAPI) for your product.
  - Include request/response examples
  - Document authentication requirements
  - Document error responses

- [ ] **Deployment documentation**
  - Document deployment process for your host
  - Document rollback procedure
  - **In codebase:** README has “Using this template”, env setup, db:migrate; `docs/where-to-start-coding.md` for feature/code layout.
  - Document troubleshooting guide

- [ ] **Runbooks**
  - Create runbook for common issues
  - Document incident response procedures
  - Document escalation procedures
  - Create on-call rotation schedule (if applicable)

### User Documentation
- [x] **User-facing content (partial)**
  - **In codebase:** FAQ at `app/(public)/faq/page.tsx` (data from `features/faq/data/faq-data.ts` + translations). Replace copy for your product.
  - Document subscription management (FAQ + Stripe customer portal link in app)
  - Support contact: `SUPPORT_EMAIL` from `app.constants.ts` (footer, contact page)
  - [ ] Add product-specific user guides if needed

---

## 13. Backup & Disaster Recovery

### Backup Strategy
- [ ] **Database backups**
  - Automated daily backups (already mentioned, but critical)
  - Test backup restoration monthly
  - Store backups in multiple locations
  - Encrypt backups at rest

- [ ] **Application backups**
  - Backup application configuration
  - Backup environment variables (securely)
  - Document all infrastructure components
  - Version control all infrastructure as code

### Disaster Recovery
- [ ] **Recovery procedures**
  - Document disaster recovery plan
  - Test disaster recovery procedures
  - Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
  - Set up monitoring for disaster scenarios

---

## 14. SSL/TLS & Domain

### SSL Certificate
- [ ] **HTTPS configuration**
  - Verify SSL certificate is valid and auto-renewing
  - Test HTTPS redirect from HTTP
  - Verify HSTS header is set
  - Test SSL configuration (SSL Labs test)

- [ ] **Domain configuration**
  - Configure production domain
  - Set up DNS records correctly
  - Verify domain ownership
  - Test domain from multiple locations

---

## 15. Email & Notifications

### Email Configuration
- [ ] **Email service (Resend)**
  - **In codebase:** `project/shared/services/email/resend.ts`; order confirmation email with template `public/templates/order-confirmation.html` (uses {{APP_NAME}}, {{SUPPORT_EMAIL}}, {{SUPPORT_PHONE}} from app.constants).
  - Verify `RESEND_API_KEY` is set in production
  - Test email delivery
  - Test transactional emails (order confirmation; add signup/password reset if using Firebase email or Resend)
  - [ ] Set up email templates for any additional flows

- [ ] **Email deliverability**
  - Configure SPF records
  - Configure DKIM records
  - Configure DMARC policy
  - Test email deliverability

- [ ] **Notification system**
  - Set up user notification preferences (if required)
  - Test email notifications
  - Test in-app notifications (if applicable)

---

## 16. Pre-Launch Testing

### Final Checks
- [ ] **End-to-end testing**
  - Test complete user journey (signup → subscription → core feature usage)
  - Test payment flow with real payment methods (small amounts)
  - Test admin dashboard functionality
  - Test all core feature types (default: calculator types; or your replacement feature)

- [ ] **Cross-browser testing**
  - Test on Chrome, Firefox, Safari, Edge
  - Test on mobile browsers (iOS Safari, Chrome Mobile)
  - Test responsive design on various screen sizes

- [ ] **Performance testing**
  - Test page load times
  - Test API response times
  - Test under moderate load
  - Verify Core Web Vitals scores (Web Vitals reporter is in place)

- [ ] **Security testing**
  - Run security scan (OWASP ZAP, Snyk, etc.)
  - Test authentication and authorization
  - Test input validation
  - Review security headers

---

## 17. Post-Launch Monitoring

### Initial Monitoring Period
- [ ] **First 24 hours**
  - Monitor error rates closely
  - Monitor payment processing
  - Monitor user signups and conversions
  - Be available for immediate issue resolution

- [ ] **First week**
  - Review error logs daily
  - Monitor performance metrics
  - Collect user feedback
  - Address critical issues immediately

- [ ] **Ongoing**
  - Weekly review of metrics and errors
  - Monthly security review
  - Quarterly performance optimization review
  - Regular backup restoration testing

---

## 18. Support & Communication

### Support System
- [x] **Support channels (structure in place)**
  - **In codebase:** Support email from `SUPPORT_EMAIL` in `app.constants.ts` (footer, contact page, order confirmation). Contact form at `app/(public)/contact/page.tsx`; messages via `app/api/shared/contact-messages/route.ts`. Admin contact messages at `/admin/contactmessages`.
  - [ ] Set support email to your domain (change SUPPORT_EMAIL in app.constants)
  - [ ] Set up support ticket system (if needed)
  - [ ] Document support procedures

- [ ] **Communication plan**
  - Plan for outage communication
  - Set up status page (if applicable)
  - Prepare user communication templates
  - Plan for feature announcements

---

## Priority Levels

### 🔴 Critical (Must have before launch)
- Security (authentication, authorization, secrets)
- Payment processing (Stripe production setup)
- Database backups
- Error handling and monitoring
- SSL/HTTPS
- Environment configuration
- Basic testing

### 🟡 Important (Should have before launch)
- Comprehensive logging and metrics
- Performance optimization
- CI/CD pipeline
- Legal documents (Terms, Privacy Policy)
- Load testing
- Disaster recovery plan

### 🟢 Nice to have (Can add post-launch)
- Advanced monitoring dashboards
- Comprehensive E2E test coverage
- Advanced caching strategies
- AWS migration planning
- Advanced analytics

---

## Template vs production

- **Template:** This repo is a SaaS template. Auth, subscriptions, payments, orders, admin, usage limits, and public pages are implemented so you can focus on your core feature and branding.
- **Production:** Launching to real users requires completing the items above for *your* environment: production env vars, live Stripe/Firebase, backups, monitoring, legal copy, and host-specific config (health checks, SSL, CI/CD). Use this checklist per deployment target.

---

## Notes

- Review this checklist before every major production deployment.
- Update this checklist as new requirements are identified.
- Mark items as complete with dates and notes.
- **Last updated:** February 2026 (full codebase scan).
