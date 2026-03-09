# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Real API documentation at `/api-documentation` — documents all REST endpoints, auth, rate limiting, and error codes
- Cookie Policy page at `/cookies` — explains essential, functional, analytics, and third-party cookies
- Cookie consent banner — shown once to new visitors; stores preference in `localStorage`
- Accessibility Statement at `/accessibility` — WCAG 2.1 AA commitment, measures taken, and known limitations
- Full Support Center at `/support` — getting started guide, account & billing FAQ, troubleshooting steps
- Footer links to Cookie Policy and Accessibility Statement pages

---

## [0.9.0] — 2026-02-21

### Added
- CI/CD pipeline via `.github/workflows/ci.yml` — lint, unit tests, integration tests, build, and security audit jobs
- Production deployment runbook (`docs/runbooks/deployment.md`)
- Rollback runbook (`docs/runbooks/rollback.md`)
- Incident response runbook (`docs/runbooks/incident-response.md`)
- Security incident response runbook + GDPR breach notification template (`docs/runbooks/security-incident-response.md`)
- OWASP Top 10 review (`docs/AI_Orchestrator/consider/owasp-top10-review.md`)
- Data retention policy (`docs/runbooks/data-retention-policy.md`)
- Cloudflare setup runbook (`docs/runbooks/cloudflare-setup.md`)
- `railway.toml` for Railway deployment with health check and migration on deploy
- `CONTRIBUTING.md` — full development setup, project structure, and contribution guide
- `checkRevoked: true` added to all `verifyIdToken` calls for immediate token revocation

### Changed
- `next` upgraded 15.0.7 → 16.0.9 to clear 4 HIGH CVEs
- CSP headers added to `middleware.ts`
- Rate limiter fixed to fail-secure during Redis outages

### Fixed
- Security audit: 1 critical `fast-xml-parser` CVE and 4 HIGH Next.js CVEs identified and partially resolved

---

## [0.8.0] — 2026-01-26

### Added
- Bun as the primary package manager (replaces pnpm)
- `bunfig.toml` configuration
- Detailed API route protection debug logging

### Changed
- Dockerfile updated to use Bun lock file
- `authenticatedFetch` and `safeFetch` refactored for cleaner request handling

---

## [0.7.0] — 2026-01-12

### Added
- SEO manifest improvements and sitemap with all pages
- FAQ page structured data (JSON-LD schema)
- Subscription trial eligibility API (`/api/subscriptions/trial-eligibility`)
- Trial usage tracking on the `User` model

### Changed
- Subscription plan changes now route exclusively through Stripe Customer Portal
- Pricing components cleaned of upgrade/downgrade logic

### Removed
- `fix-stripe-customer` API route (unused)

### Fixed
- CSRF protection enforced on all mutation operations
- Error details sanitised to prevent information leakage in API responses
- Firebase error codes mapped to user-friendly messages

---

## [0.6.0] — 2026-01-11

### Added
- Prometheus metrics endpoint (`/api/metrics`, bearer-token protected)
- HTTP request, error, and database query metrics
- Security audit documentation and CORS policy hardening
- `envUtil` centralised environment variable access

### Changed
- Rate limiter refactored to fail-secure (deny on Redis outage)
- `process.env` replaced with `envUtil` throughout the codebase
- CORS policy updated — wildcard (`*`) removed for credentialed requests

---

## [0.5.0] — 2026-01-10

### Added
- API route protection middleware (`withGetProtection`, `withUserProtection`) with rate limiting and CSRF checks
- CSRF token binding to Firebase UID
- Unified `AppProvider` for authentication and user profile state
- React Query (TanStack Query) migration — replaced SWR
- Placeholder Support and API Documentation pages
- Input validation schemas (SQL injection, XSS protection)
- Translation scripts: missing-key finder and auto-key generator

### Changed
- Authentication flow refactored to in-memory token storage
- User provisioning updated with timezone detection
- Subscription flow consolidated to Stripe Customer Portal

---

## [0.4.0] — 2025-12-13

### Added
- Comprehensive API route catalog documentation
- Account management architecture docs (data loading sequences, component interactions)
- Admin dashboard documentation

---

## [0.3.0] — 2025-12-01

### Added
- studio tools: mortgage, loan, investment, retirement generators
- Subscription tiers (Free, Pro, Enterprise) with feature-gating
- Stripe integration (subscriptions, Customer Portal)
- Firebase Authentication + custom claims for subscription tier
- Order and billing history

---

## [0.2.0] — 2025-11-30

### Added
- Admin dashboard (customers, subscriptions, analytics, contact messages)
- Contact form with email notifications
- FAQ, About, Features, Pricing public pages
- Privacy Policy and Terms of Service pages
- i18n support via `next-intl`

---

## [0.1.0] — 2025-11-16

### Added
- Initial Next.js 15 project scaffold
- PostgreSQL database with Prisma ORM
- Firebase Authentication
- Tailwind CSS + shadcn/ui component library
- Basic public marketing pages (home, pricing)
