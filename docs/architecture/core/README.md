# Core Architecture Documentation

## Overview

Essential architectural patterns and systems that define how the application is built and secured.

**What's in Core:**
- Fundamental patterns engineers need to understand the system
- Security, authentication, API design
- Database, performance, code organization
- Error handling and logging

**What's NOT in Core:**
- Specific features (see `/domain`)
- Deployment guides (see `/consider`)
- Testing strategies (see `/consider`)
- SEO implementation (see `/domain`)

---

## Core Documentation

### 🔐 Security & Authentication

**[Security](./security.md)** - *Comprehensive security implementation*
- CSRF protection (token-based)
- CORS configuration (origin validation)
- Rate limiting (Redis-backed)
- PII sanitization (GDPR-compliant)
- Input validation (Zod schemas)
- SQL injection prevention
- XSS protection

**[Authentication](./authentication.md)** - *Auth system with RBAC*
- Firebase Auth integration
- Server-side token verification
- Role-based access control (admin/user)
- Session management (cookies + localStorage)
- Route protection patterns
- Authentication flows

### 🌐 API & Backend

**[API Architecture](./api.md)** - *RESTful API design*
- Route structure and organization
- Multi-layer protection (CORS, rate limit, CSRF, auth)
- Request/response patterns
- HTTP conventions and status codes
- Pagination and filtering

### 🗄️ Data Layer

**[Database](./database.md)** - *Database patterns and validation*
- Prisma ORM (PostgreSQL)
- Schema design patterns
- Query patterns and optimization
- Data validation (Zod)
- Soft deletes and timestamps

### ⚡ Performance

**[Performance & Caching](./performance.md)** - *Multi-layer caching strategy*
- Redis caching (server-side)
- Next.js caching (SSG/ISR)
- Client-side caching (SWR, React Query)
- Performance optimization techniques

### 📁 Code Organization

**[Code Structure](./code-structure.md)** - *Project organization*
- Directory structure (app, features, shared)
- Component architecture (server vs client)
- File naming conventions
- Import patterns and path aliases

### 🚨 Observability

**[Error Handling](./error-handling.md)** - *Error handling and recovery*
- API error patterns
- Global error handlers
- Error boundaries (React)
- Logging strategies

**[Logging & Monitoring](./logging-monitoring.md)** - *Dual logging system*
- DebugLogger (development)
- SystemLogger (production)
- PII sanitization in logs
- Structured logging patterns

---

## Quick Reference

### File Count: 9 files (down from 26)

**Before consolidation:** 26 files, ~16K lines
**After consolidation:** 9 files, focused and essential

### What Was Consolidated

| Old Files (3-4 each) | New File |
|----------------------|----------|
| security.md, csrf-protection.md, cors-configuration.md | security.md |
| authentication-system.md, authorization-roles.md, session-management.md | authentication.md |
| api-architecture.md, api-route-protection.md, rate-limiting.md | api.md |
| code-organization.md, directory-structure.md, component-architecture.md | code-structure.md |
| database-patterns.md, data-validation.md | database.md |
| performance-optimization.md, caching-strategies.md | performance.md |

### What Was Removed

Non-core files moved or archived:
- `seo-strategy.md` → Not core architecture
- `deployment-strategy.md` → Operational guide
- `testing-strategy.md` → Testing guide
- `typescript-patterns.md` → Covered in code-structure
- `state-management.md` → React patterns (covered)
- `environment-management.md` → Config detail
- `infrastructure-services.md` → Specific services

---

## How to Use This Documentation

### For New Engineers

Start with these in order:
1. [Code Structure](./code-structure.md) - Understand project organization
2. [Authentication](./authentication.md) - Auth system and flows
3. [API Architecture](./api.md) - API patterns and protection
4. [Database](./database.md) - Data layer and validation

### For Specific Tasks

- **Adding API endpoint:** [API Architecture](./api.md)
- **User auth/permissions:** [Authentication](./authentication.md)
- **Security review:** [Security](./security.md)
- **Performance issue:** [Performance](./performance.md)
- **Error handling:** [Error Handling](./error-handling.md)
- **Database query:** [Database](./database.md)

### For System Understanding

Read all core docs to understand:
- How requests are protected (CORS, CSRF, rate limit, auth)
- How data flows (client → API → database)
- How errors are handled and logged
- How caching works across layers
- How code is organized and structured

---

## Architecture Principles

### Security First
- Multi-layer protection on all endpoints
- Server-side verification of everything
- PII sanitization automatic
- Input validation required

### Performance by Default
- Multi-layer caching strategy
- Optimized database queries
- Static generation where possible
- Client-side optimization

### Developer Experience
- Clear code organization
- Type-safe patterns (TypeScript, Prisma, Zod)
- Standardized conventions
- Comprehensive error handling

### Maintainability
- Feature-based organization
- Clear separation of concerns
- Documented patterns
- Consistent naming

---

## Related Documentation

- [Domain Architecture](../domain/) - Feature-specific architecture
- [Implementation Plans](../../consider/) - Guides and strategies
- [Project Overview](../../overview.md) - High-level project info

---

*Last Updated: January 2026*
*Consolidation: Reduced from 26 files to 9 essential documents*
