#!/usr/bin/env bash
# db-reset-and-migrate.sh
#
# Drops all tables, re-runs all Drizzle migrations from scratch, and optionally
# seeds the database. Intended for local development and CI only — never run
# this against a production database.
#
# Usage:
#   ./scripts/db-reset-and-migrate.sh          # reset + migrate
#   ./scripts/db-reset-and-migrate.sh --seed   # reset + migrate + seed (if seed script exists)

set -euo pipefail

# ─── Safety guard ──────────────────────────────────────────────────────────────
APP_ENV="${APP_ENV:-development}"
if [[ "$APP_ENV" == "production" ]]; then
  echo "ERROR: db-reset-and-migrate.sh must not run in production (APP_ENV=production)."
  exit 1
fi

# ─── Load .env if present ──────────────────────────────────────────────────────
if [[ -f ".env" ]]; then
  echo "Loading .env …"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

echo ""
echo "─────────────────────────────────────────────"
echo " DB Reset & Migrate"
echo " DATABASE_URL: ${DATABASE_URL%@*}@***"
echo " APP_ENV:      $APP_ENV"
echo "─────────────────────────────────────────────"
echo ""

read -r -p "This will DROP ALL DATA. Continue? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Reset ─────────────────────────────────────────────────────────────────────
echo "Resetting database …"
bun run db:push --force

# ─── Migrate ───────────────────────────────────────────────────────────────────
echo "Running migrations …"
bun run db:migrate

# ─── Optional seed ─────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--seed" ]]; then
  if [[ -f "scripts/seed.ts" ]]; then
    echo "Running seed …"
    bun scripts/seed.ts
  else
    echo "No seed script found at scripts/seed.ts — skipping."
  fi
fi

echo ""
echo "Done. Database is clean and up to date."
