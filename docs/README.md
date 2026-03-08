# Documentation

This is the documentation hub for the SaaS template. The template ships with auth, subscriptions, payments, and admin pre-built so you can focus on your core product.

---

## What's in this folder

| Folder | Purpose |
|--------|---------|
| [`architecture/`](./architecture/) | How the system is designed — core patterns and domain features |
| [`adr/`](./adr/) | Architecture Decision Records — what was decided and why |
| [`runbooks/`](./runbooks/) | Operational procedures — deploy, rollback, incidents, monitoring |
| [`checklists/`](./checklists/) | Pre-launch review checklists — security, performance, compliance |
| [`troubleshooting/`](./troubleshooting/) | Step-by-step fixes for common problems |
| [`guides/`](./guides/) | AI role definitions and architecture proposals |
| [`archive/`](./archive/) | Completed plans and superseded decisions |

---

## Quick navigation by role

### New to the project?
1. Read [TEMPLATE_GUIDE.md](./TEMPLATE_GUIDE.md) — the master reference for what's built and how to make it yours
2. Read [where-to-start-coding.md](./where-to-start-coding.md) — points you to the exact files to edit
3. Read [architecture/overview.md](./architecture/overview.md) — tech stack and system design

### Building a feature?
- **API patterns:** [architecture/core/api.md](./architecture/core/api.md)
- **Auth and roles:** [architecture/core/authentication.md](./architecture/core/authentication.md)
- **Database queries:** [architecture/core/database.md](./architecture/core/database.md)
- **Project layout:** [architecture/core/code-structure.md](./architecture/core/code-structure.md)

### Working on a specific domain?
- **Business model / subscriptions:** [architecture/domain/business-model.md](./architecture/domain/business-model.md)
- **Calculator (default feature):** [architecture/domain/calculator-system.md](./architecture/domain/calculator-system.md)
- **Admin dashboard:** [architecture/domain/admin-dashboard.md](./architecture/domain/admin-dashboard.md)
- **Account management:** [architecture/domain/account-management.md](./architecture/domain/account-management.md)

### Security or production review?
- [architecture/core/security.md](./architecture/core/security.md)
- [checklists/security.md](./checklists/security.md)
- [checklists/production-readiness.md](./checklists/production-readiness.md)

### Something broken in production?
- [troubleshooting/](./troubleshooting/) — Stripe, subscription, translation issues
- [runbooks/incident-response.md](./runbooks/incident-response.md)
- [runbooks/rollback.md](./runbooks/rollback.md)

---

## Architecture overview (one paragraph)

The template is a monorepo with two independent servers. The **frontend** (`frontend/`) is a React 19 SPA built with Vite and TanStack Router. The **backend** (`backend/`) is a Hono API server running on Bun. They share no runtime code. Firebase handles authentication; PostgreSQL (via Prisma) stores users, orders, and feature usage; Stripe handles payments and subscriptions; Redis handles rate limiting and caching.

For the full picture: [architecture/overview.md](./architecture/overview.md).
