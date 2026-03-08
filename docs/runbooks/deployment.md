# Deployment Runbook

**Last updated:** Feb 21, 2026  
**Stack:** Railway (hosting) + Cloudflare (DNS/CDN/proxy)  
**Related:** [Rollback Runbook](./rollback.md), [Cloudflare Setup](./cloudflare-setup.md), [Incident Response](./incident-response.md)

---

## First-Time Production Setup

Follow these steps once before the first deploy.

### Step 1 — Create Railway project

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Select this repository and the `master` branch.
3. Railway detects the `Dockerfile` in `project/` automatically (via `railway.toml`).
4. Set the **root directory** to `project/` in Railway → Settings → Source.

### Step 2 — Add Railway services

In your Railway project, add two services alongside the app:

- **PostgreSQL:** Railway → New Service → Database → Add PostgreSQL
- **Redis:** Railway → New Service → Database → Add Redis

Railway injects `DATABASE_URL` and `REDIS_URL` automatically into your app service as shared variables.

### Step 3 — Set environment variables

Railway Dashboard → your app service → Variables → Add all the following:

```
NODE_ENV=production
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Firebase client (public — safe to set here)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-only — keep secret)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=        # paste with literal \n, wrapped in quotes

# Security
CSRF_SECRET=                 # openssl rand -hex 32
ENCRYPTION_KEY=              # 32-char string
ADMIN_SPECIAL_CODE_HASH=     # bcrypt hash of your admin code

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com

# Storage (Cloudflare R2 — optional)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
R2_ENABLED=true

# CORS — your production domains
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Observability
METRICS_SECRET=              # any long random string — protects /api/metrics
NEXT_PUBLIC_LOG_LEVEL=warn
NEXT_PUBLIC_DEBUG=false
```

> **Tip:** `DATABASE_URL` and `REDIS_URL` are injected automatically by Railway — don't set them manually.

> **Firebase private key:** In Railway, paste the key with literal `\n` characters (not actual newlines). If it contains `\n` in the source JSON, paste it exactly as-is including the surrounding quotes:  
> `"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...`

### Step 4 — Add custom domain

Railway Dashboard → your service → Settings → Domains → Add Domain → type `yourdomain.com`.

Railway gives you a CNAME target. Add this in Cloudflare DNS as a proxied CNAME record.

See [Cloudflare Setup](./cloudflare-setup.md) for the full Cloudflare configuration.

### Step 5 — Run first deploy

```bash
git push origin master
```

Railway auto-deploys on push. The Dockerfile runs `prisma migrate deploy` then `bun start`.

Watch the build in Railway Dashboard → Deployments → latest.

### Step 6 — Verify

```bash
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/api/ready
curl -f https://yourdomain.com/api/live
```

All three must return HTTP 200.

---

## Ongoing Deploy Process

Every subsequent deploy follows this flow:

```
git push origin master
    → GitHub Actions CI runs (lint → unit tests → integration tests → build)
    → All CI checks pass (required by branch protection)
    → Railway auto-deploys the latest commit
    → GitHub Actions deploy.yml runs post-deploy health check
```

### Branch Protection (required setup)

In GitHub → repo → Settings → Branches → Branch protection rules → Add rule for `master`:

- [x] Require status checks to pass before merging
- Required checks: `Lint & Type Check`, `Unit Tests`, `Integration Tests`, `Build`
- [x] Require branches to be up to date before merging

This ensures Railway never deploys a commit that failed CI.

### GitHub Secrets (required setup)

In GitHub → repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens → Create token |
| `PRODUCTION_URL` | `https://yourdomain.com` |

---

## Pre-Deploy Checklist

Run through these before every production deploy:

- [ ] All CI checks green (lint, unit tests, integration tests, build)
- [ ] `bun audit` reviewed — no new critical/high vulnerabilities
- [ ] Production environment variables complete and correct
- [ ] Database migrations reviewed (if any) — destructive migrations need separate rollback plan
- [ ] Rollback target identified (previous Railway deployment)

---

## Database Migrations

Railway runs `prisma migrate deploy` automatically on startup (via `railway.toml` `startCommand`).

### Non-destructive migrations (adding columns, tables, indexes)

Safe to deploy normally — old code is compatible with the new schema during the transition.

### Destructive migrations (dropping/renaming columns)

1. First deploy: add the new column alongside the old (backwards compatible).
2. Second deploy: switch application code to use new column.
3. Third deploy: remove old column after confirming no references remain.

**Never drop a column in the same commit that removes the code referencing it.**

---

## Environment Variables: All Required Values

See `project/example.env` for the full list with descriptions.

**Generate secrets:**

```bash
# CSRF_SECRET (must be exactly 64 hex chars)
openssl rand -hex 32

# ENCRYPTION_KEY (32 chars)
openssl rand -base64 24 | head -c 32

# ADMIN_SPECIAL_CODE_HASH
node -e "const b = require('bcryptjs'); b.hash('your-admin-code', 12).then(console.log)"

# METRICS_SECRET (any long random string)
openssl rand -hex 32
```

---

## Rollback

See [Rollback Runbook](./rollback.md). Railway keeps all previous deployments — click Redeploy on any previous build in the Deployments tab.
