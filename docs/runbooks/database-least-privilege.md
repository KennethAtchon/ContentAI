# Database Least Privilege — Runbook

**Item 32 — Feb 21, 2026**

---

## Current State

Railway PostgreSQL provisions a single database user with full owner privileges.
The app connects using `DATABASE_URL` which uses this owner-level user.

**Risk:** If the application is compromised, an attacker has full DDL access (DROP TABLE, etc.).

---

## Recommended Setup

Create two additional PostgreSQL roles:

| Role | Permissions | Used by |
|------|-------------|---------|
| `your_app_db` | SELECT, INSERT, UPDATE, DELETE on all tables | App at runtime |
| `your_app_readonly` | SELECT on all tables | Reporting, admin queries, analytics |
| `your_app_owner` (existing) | Full ownership | Migrations only (`prisma migrate deploy`) |

---

## Implementation

### 1. Create roles (run as Railway superuser)

```sql
-- Create the limited app user
CREATE USER your_app_db WITH PASSWORD '<strong-random-password>';

-- Grant runtime permissions only
GRANT CONNECT ON DATABASE postgres TO your_app_db;
GRANT USAGE ON SCHEMA public TO your_app_db;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_db;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_db;

-- Ensure future tables also get these grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO your_app_db;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO your_app_db;

-- Create the read-only user
CREATE USER your_app_readonly WITH PASSWORD '<strong-random-password>';
GRANT CONNECT ON DATABASE postgres TO your_app_readonly;
GRANT USAGE ON SCHEMA public TO your_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO your_app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO your_app_readonly;
```

### 2. Update Railway environment variables

| Variable | Value | Used for |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://your_app_db:...@host/db` | App runtime |
| `DATABASE_MIGRATION_URL` | `postgresql://your_app_owner:...@host/db` | Prisma migrations |
| `DATABASE_READONLY_URL` | `postgresql://your_app_readonly:...@host/db` | Analytics / reporting |

### 3. Update prisma schema datasource (for migration URL)

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DATABASE_MIGRATION_URL")
}
```

The `directUrl` is used by `prisma migrate deploy` (owner privileges).
The `url` is used at runtime by the app (limited privileges).

### 4. Verify

```sql
-- Confirm your_app_db cannot drop tables
SET ROLE your_app_db;
DROP TABLE "user"; -- Should fail with "permission denied"

-- Confirm your_app_db can read/write
SELECT COUNT(*) FROM "user"; -- Should succeed
```

---

## Railway Limitations

Railway's managed PostgreSQL does not currently expose a direct `psql` shell in the UI.
Use the Railway CLI to connect:

```bash
railway connect postgresql
# Then run the SQL above
```

Or connect using a local psql with the Railway internal DATABASE_URL.

---

## Timeline

- **Phase 1** (now): Document and plan (this runbook)
- **Phase 2** (post-launch): Create roles in staging, test, promote to production
- **Phase 3**: Remove owner-level `DATABASE_URL` from app runtime environment

---

## See Also

- `database-backups.md` — backup strategy
- `deployment.md` — environment variable setup
