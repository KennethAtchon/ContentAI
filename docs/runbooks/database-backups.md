# Database Backups Runbook

**Status:** Railway PostgreSQL Pro plan includes automated backups; enable in the dashboard after first deploy.

---

## Backup Strategy

| Type | Frequency | Retention | Provider |
|------|-----------|-----------|----------|
| Automated daily snapshot | Daily at 03:00 UTC | 7 days | Railway PostgreSQL (Pro plan) |
| Point-in-time recovery (PITR) | Continuous WAL | 7 days | Railway PostgreSQL (Pro plan) |
| Manual pre-deploy snapshot | Before each release | Keep 3 most recent | Manual via Railway CLI |

---

## Enabling Automated Backups (Railway)

1. Railway Dashboard → Your Project → PostgreSQL service
2. Click **Settings** → **Backups**
3. Toggle **Enable Automated Backups** → ON
4. Verify the schedule shows **Daily at 03:00 UTC**

> Requires **Railway Pro plan** ($20/month). Hobby plan does not include backups.

---

## Manual Pre-Deploy Snapshot

Run this before any major release or schema migration:

```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli
railway login

# Create a manual backup snapshot
railway run --service postgresql pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Or using pg_dump directly against the Railway Postgres URL
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"
```

Store the dump in a secure location (encrypted S3 bucket, or local encrypted drive). Delete dumps older than 30 days.

---

## Restoring from Backup

### From Railway PITR

1. Railway Dashboard → PostgreSQL service → Backups
2. Select a backup timestamp
3. Click **Restore** — Railway provisions a new database from that point
4. Update `DATABASE_URL` in your app service to point to the restored DB
5. Verify with `bun run db:deploy` (apply any pending migrations)

### From Manual Dump

```bash
# Restore from a custom-format dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  backup-20260221-120000.dump

# Run any pending migrations
bun run db:deploy
```

---

## Backup Verification

Test restores quarterly on a staging database:

```bash
# 1. Restore to staging DB
pg_restore --dbname="$STAGING_DATABASE_URL" --clean backup.dump

# 2. Run smoke tests against staging
bun run test:integration

# 3. Verify row counts match production
psql "$STAGING_DATABASE_URL" -c "SELECT COUNT(*) FROM \"user\";"
psql "$STAGING_DATABASE_URL" -c "SELECT COUNT(*) FROM feature_usage;"
```

Document each restore test in the table below:

| Date | Backup tested | Restore time | Result | Tested by |
|------|--------------|--------------|--------|-----------|
| _(fill in)_ | _(date)_ | _(mins)_ | ✅/❌ | _(name)_ |

---

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Railway PITR restore | ~15 min | Up to 5 min |
| Manual dump restore | ~30 min | Time of last manual dump |
| Full DB rebuild from scratch | ~2 hours | N/A (no user data recovered) |

---

## Backup Monitoring Alert

Add this alert to your monitoring setup (`alerting.md`):

> **Alert:** "Daily backup not completed by 06:00 UTC" → Severity: **Warning**

Check Railway Dashboard → PostgreSQL → Backups each morning until automated alerting is configured.

---

## See Also

- `deployment.md` — full deploy process
- `rollback.md` — how to roll back a deployment
- `data-retention-policy.md` — retention policy
