# ADR-006: Host on Railway

**Date:** Nov 2025  
**Status:** Accepted

## Context

We need a hosting platform for a Dockerised Next.js app + PostgreSQL + Redis, with simple deployment, managed TLS, and a path to production.

## Decision

Host on **Railway** with:
- App service (Docker, from `project/Dockerfile`)
- PostgreSQL service (Railway managed)
- Redis service (Railway managed)
- Cloudflare for DNS, CDN, and WAF in front of Railway

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Vercel | No persistent compute; serverless limits for Prisma connections; PostgreSQL would need separate provider |
| Render | Similar to Railway but less streamlined DB provisioning |
| AWS ECS + RDS | High operational overhead for a small team |
| Fly.io | Good option; Railway chosen for simpler UX and DB integration |

## Consequences

- ✅ Managed PostgreSQL + Redis in the same project
- ✅ Automatic TLS via Let's Encrypt for Railway subdomain
- ✅ `railway.toml` + `Dockerfile` provide reproducible deploys
- ✅ `prisma migrate deploy` runs automatically on every deploy
- ⚠️ Railway Pro plan required for automated DB backups
- ⚠️ Cold starts on hobby plan (not an issue on Pro)
- ⚠️ Railway is not available in all regions; EU-West chosen for GDPR compliance
