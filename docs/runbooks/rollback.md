# Rollback Runbook

**Last updated:** Feb 21, 2026  
**Related:** [Deployment Runbook](./deployment.md), [Incident Response](./incident-response.md)

---

## When to Roll Back

Roll back when:
- Production is returning 5xx errors at a rate > 1% of requests
- A critical security vulnerability was introduced by the deploy
- Core user flows (sign-in, calculator, checkout) are broken
- The health endpoints (`/api/health`, `/api/ready`) return non-200

**Do not roll back for:**
- Minor UI glitches — hotfix forward instead
- A single flaky error in logs — investigate before rolling back

---

## Railway Rollback

Railway keeps all previous deployments and supports instant redeployment.

1. Open Railway Dashboard → your project → Deployments tab.
2. Find the last known-good deployment (check timestamp or git SHA).
3. Click **⋯ → Redeploy** on that deployment.
4. Watch the build and startup logs in the deployment panel.
5. Verify health endpoints return 200 after Railway marks the deployment as active:
   ```bash
   curl -f https://yourdomain.com/api/health
   curl -f https://yourdomain.com/api/ready
   ```

Typical rollback time: 1–3 minutes (Railway reruns the existing Docker image — no rebuild needed).

> **Cloudflare note:** If you have caching enabled, you may need to purge the Cloudflare cache after a rollback:  
> Cloudflare Dashboard → Caching → Purge Cache → Purge Everything.

---

## Database Rollback

> **Warning:** Database rollbacks are high-risk. Always take a backup before attempting.

### Backup before rollback

```bash
# PostgreSQL dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### If the migration was non-destructive (added columns/tables)

The old application code will still work with the new schema — no database rollback needed. Just roll back the application code.

### If the migration was destructive (dropped/renamed columns)

1. Stop the application (or put it in maintenance mode) to prevent further writes.
2. Restore from the pre-migration backup:
   ```bash
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```
3. Roll back the application code.
4. Restart the application.
5. Verify the database is in the expected state.

### Prisma migration table cleanup

If you need to mark a migration as "not applied" in Prisma's migration history:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = 'MIGRATION_NAME';
```

---

## Hotfix Process (Alternative to Rollback)

For small issues where rolling back would cause more disruption than fixing forward:

1. Create a hotfix branch from the deployed SHA:
   ```bash
   git checkout -b hotfix/description <deployed-sha>
   ```
2. Make the minimal fix.
3. Run `bun run test:ci` locally.
4. Merge to master and deploy immediately (skip normal review process for critical hotfixes).
5. Tag the hotfix release.

---

## Post-Rollback Actions

After any rollback:

1. **Create an incident report** — see [Incident Response](./incident-response.md).
2. **Document what went wrong** — add a section to the incident report.
3. **Identify the root cause** — why did tests not catch this before deploy?
4. **Add a regression test** — prevent the same issue from reaching production again.
5. **Update the deployment checklist** — if the issue revealed a gap in the pre-deploy checks.
