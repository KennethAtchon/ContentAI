# Incident Response Runbook

**Last updated:** Feb 21, 2026  
**Related:** [Deployment Runbook](./deployment.md), [Rollback Runbook](./rollback.md), [Security Incident Response](./security-incident-response.md)

---

## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|--------------|---------|
| **P1 — Critical** | Production down, data breach, payment failure | Immediate (< 15 min) | All users get 500, DB unreachable, Stripe keys compromised |
| **P2 — High** | Core feature broken, significant degradation | < 1 hour | Sign-in broken, generator errors for all users, Redis down |
| **P3 — Medium** | Non-critical feature broken, elevated error rate | < 4 hours | Admin dashboard broken, export feature failing |
| **P4 — Low** | Minor bug, cosmetic issue | Next business day | UI misalignment, incorrect copy on a single page |

---

## Response Process

### 1. Detect

Sources of incident detection:
- Uptime monitor alert (BetterUptime / Pingdom)
- Error spike in logs
- User report
- Failed health check: `/api/health`, `/api/ready`, `/api/live`

### 2. Assess severity

```bash
# Check health endpoints
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/api/ready

# Check recent error logs (Railway)
# Railway Dashboard → your project → Logs → filter by ERROR

# Check error monitoring (if configured)
# GET /api/health/error-monitoring
curl https://yourdomain.com/api/health/error-monitoring \
  -H "Authorization: Bearer <admin-token>"
```

### 3. Declare incident and notify

For P1/P2:
- Post in team Slack/Discord channel: `🔴 INCIDENT P1: [brief description]`
- Include: what is broken, what users are affected, time detected

### 4. Investigate

Common investigation steps:

```bash
# Recent deployments (check if issue correlates with a deploy)
git log --oneline -10

# Database connectivity
curl https://yourdomain.com/api/admin/database/health \
  -H "Authorization: Bearer <admin-token>"

# Metrics endpoint
curl https://yourdomain.com/api/metrics

# Check Railway logs for patterns
# Filter for: ERROR, Exception, 500, 503
```

### 5. Mitigate

Options in order of preference:
1. **Hotfix** — if the issue is small and clearly understood
2. **Rollback** — if the issue was introduced by the latest deploy (see [Rollback Runbook](./rollback.md))
3. **Feature flag** — disable the broken feature while fixing
4. **Maintenance mode** — if the entire app is unusable, take it down with a maintenance page

### 6. Resolve and verify

```bash
# After fix/rollback, verify all health endpoints are green
curl -f https://yourdomain.com/api/health    # { status: "ok" }
curl -f https://yourdomain.com/api/ready     # { status: "ready" }

# Check error rate drops in logs
```

### 7. Post-mortem

For P1/P2 incidents, write a post-mortem within 48 hours (see [Post-Mortem Template](#post-mortem-template) below).

---

## Common Issues & Quick Fixes

### Application returns 500 for all requests

1. Check Railway deployment status — did the latest deploy fail?
2. Check `/api/health` — is the DB connection working?
3. Check environment variables — was a required var removed or changed?
4. Roll back if issue correlates with a recent deploy.

### Database connection errors

```bash
# Test DB connectivity directly
psql $DATABASE_URL -c "SELECT 1;"

# Check Prisma connection pool
curl https://yourdomain.com/api/admin/database/health \
  -H "Authorization: Bearer <admin-token>"
```
- Verify `DATABASE_URL` is set correctly in the deployment environment.
- Check if the database server is up (Railway Postgres status page).
- Check connection pool limits — if too many connections, restart the app or scale.

### Redis connection errors

- Verify `REDIS_URL` is correct.
- Check Redis server status.
- The app degrades gracefully without Redis (rate limiting falls back, sessions may be affected).

### Firebase authentication failing

- Check Firebase project status at [status.firebase.google.com](https://status.firebase.google.com).
- Verify `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` are set correctly.
- Token verification errors may appear in logs as `auth/invalid-credential`.

### Stripe webhooks not processing

- Check Stripe dashboard → Developers → Webhooks → your endpoint → recent events.
- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook signing secret.
- Verify the webhook endpoint `POST /api/subscriptions/webhook` is reachable.

---

## On-Call Procedures

> **Note:** Formal on-call rotation is not yet configured. Until it is, all team members should monitor the production environment during and after deploys.

### During a deploy

- The person deploying is responsible for monitoring for 30 minutes post-deploy.
- Watch: Railway deploy logs, health endpoints, error monitoring endpoint.

### Escalation path

1. Deploying engineer investigates first.
2. If not resolved in 30 minutes → escalate to lead/senior engineer.
3. If data breach suspected → immediately follow [Security Incident Response](./security-incident-response.md).

---

## Post-Mortem Template

```markdown
## Incident Report: [Short Title]

**Date:** YYYY-MM-DD  
**Duration:** HH:MM (detected at HH:MM, resolved at HH:MM)  
**Severity:** P1 / P2 / P3  
**Author:** [Name]

### Summary

[1–2 sentence summary of what happened and impact.]

### Timeline

| Time | Event |
|------|-------|
| HH:MM | Incident detected by [monitoring / user report] |
| HH:MM | [Action taken] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix deployed] |
| HH:MM | Incident resolved |

### Root Cause

[Explain the underlying cause — not just the symptom.]

### Impact

- Users affected: [number / percentage]
- Duration: [X minutes]
- Data loss: [Yes / No — details if yes]

### Resolution

[What was done to fix it.]

### Prevention

- [ ] [Action to prevent recurrence — e.g. add a test, update checklist, add monitoring]
- [ ] [Another action]
```
