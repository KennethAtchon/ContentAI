# Production Checklists

This folder contains periodic review checklists for maintaining application quality, security, and production readiness.

**Purpose:** These checklists serve as reminders and sanity checks. Review them periodically (see frequencies below) to ensure nothing is missed. Items are intentionally left unchecked so the lists act as reminders, not completion trackers.

---

## Review Frequency

| Checklist | When to review |
|-----------|----------------|
| [security.md](./security.md) | Monthly or before major releases |
| [production-readiness.md](./production-readiness.md) | Before each deployment |
| [performance.md](./performance.md) | Quarterly or after major changes |
| [testing.md](./testing.md) | Before releases |
| [documentation.md](./documentation.md) | Quarterly |
| [monitoring.md](./monitoring.md) | Monthly |
| [compliance.md](./compliance.md) | Quarterly or when regulations change |

---

## Checklist Files

- **[security.md](./security.md)** — Authentication (Firebase), API protection, headers, data protection, dependencies, incident response
- **[production-readiness.md](./production-readiness.md)** — Env config, database, infrastructure, app build, monitoring, rollback
- **[performance.md](./performance.md)** — Frontend (Web Vitals, bundle), backend/DB, network, load testing
- **[testing.md](./testing.md)** — Unit, integration, E2E, security, browser/accessibility, CI
- **[documentation.md](./documentation.md)** — Code, user, developer, API, ops, security, architecture docs
- **[monitoring.md](./monitoring.md)** — App/infra monitoring, logging, alerting, dashboards, error tracking
- **[compliance.md](./compliance.md)** — Privacy, GDPR, retention, security compliance, accessibility, legal

---

## Project context (this repo)

Use these as quick pointers when working through the checklists:

| Area | Where to look |
|------|----------------|
| **Env vars** | `project/shared/utils/config/envUtil.ts`, `project/example.env` |
| **Auth** | Firebase Auth; `project/features/auth/`, `project/shared/services/api/authenticated-fetch.ts` |
| **API protection** | `project/features/auth/services/firebase-middleware.ts`, rate limiter, CORS |
| **Database** | Prisma; `project/shared/services/db/prisma.ts`, `project/prisma/` |
| **Subscriptions / payments** | Stripe; `project/features/subscriptions/`, `project/shared/constants/subscription.constants.ts` |
| **Logging / metrics** | `project/shared/services/observability/`, `project/app/api/metrics/route.ts` |
| **Architecture & patterns** | [AI_Orchestrator](../AI_Orchestrator/index.md), [logging & monitoring](../AI_Orchestrator/architecture/core/logging-monitoring.md) |

---

**Note:** Some items are checked where the codebase clearly implements them (as of the last audit). Unchecked items may be done but not verified, or still pending. Re-run an audit or verify manually before releases and update checkboxes as needed.
