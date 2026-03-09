# Architecture Documentation

Architecture docs are split into two categories:

- **`core/`** — Reusable patterns: auth, API design, database, security, performance, error handling, logging. These apply to any project.
- **`domain/`** — Template-specific business logic: subscription tiers, calculator system, admin dashboard, account management.

Start with [overview.md](./overview.md) for the full tech stack and system design.

---

## Core patterns

| Doc | What it covers |
|-----|---------------|
| [code-structure.md](./core/code-structure.md) | Project layout, feature modules, naming conventions |
| [api.md](./core/api.md) | REST API design, route protection, rate limiting, request/response patterns |
| [authentication.md](./core/authentication.md) | Firebase Auth, token verification, RBAC, route guards |
| [security.md](./core/security.md) | CSRF, CORS, rate limiting, PII sanitization, input validation |
| [database.md](./core/database.md) | Prisma patterns, schema design, query patterns, Zod validation |
| [performance.md](./core/performance.md) | Caching strategy (Redis, React Query), optimization techniques |
| [error-handling.md](./core/error-handling.md) | API error patterns, error boundaries, logging |
| [logging-monitoring.md](./core/logging-monitoring.md) | Debug logger, system logger, Prometheus metrics |

## Domain features

| Doc | What it covers |
|-----|---------------|
| [business-model.md](./domain/business-model.md) | Subscription tiers, pricing, usage limits, payment flows |
| [subscription-system.md](./domain/subscription-system.md) | Firebase Stripe Extension, subscription lifecycle, custom claims |
| [studio-system.md](./domain/studio-system.md) | ReelStudio workspace: reel discovery, analysis, generation, queue |
| [generation-system.md](./domain/generation-system.md) | AI content generation pipeline, Claude integration, feature gating |
| [account-management.md](./domain/account-management.md) | Profile, usage dashboard, subscription management |
| [admin-dashboard.md](./domain/admin-dashboard.md) | Metrics, customer/order/subscription management |

## System diagrams

[diagrams.md](./diagrams.md) — Mermaid diagrams for system architecture, auth flow, data flow, and deployment pipeline.
