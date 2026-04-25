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

DB_URL_REWRITTEN=0

normalize_database_url_for_host() {
  local normalized
  normalized="$(
    DATABASE_URL="$DATABASE_URL" bun -e '
      import { existsSync } from "node:fs";

      const raw = process.env.DATABASE_URL;
      if (!raw) {
        console.error("DATABASE_URL is not set.");
        process.exit(1);
      }

      const url = new URL(raw);
      const runningInDocker = existsSync("/.dockerenv");

      if (!runningInDocker && url.hostname === "postgres") {
        url.hostname = "localhost";
        process.stdout.write(`${url.toString()}\nrewritten`);
      } else {
        process.stdout.write(`${raw}\noriginal`);
      }
    '
  )"

  DATABASE_URL="${normalized%$'\n'*}"
  export DATABASE_URL

  if [[ "${normalized##*$'\n'}" == "rewritten" ]]; then
    DB_URL_REWRITTEN=1
  fi
}

assert_database_reachable() {
  if ! DATABASE_URL="$DATABASE_URL" bun -e '
    import net from "node:net";

    const raw = process.env.DATABASE_URL;
    if (!raw) process.exit(1);

    const url = new URL(raw);
    const host = url.hostname;
    const port = Number(url.port || "5432");
    const socket = net.connect({ host, port });

    const fail = (message) => {
      console.error(message);
      process.exit(1);
    };

    socket.setTimeout(3000);
    socket.once("connect", () => {
      socket.end();
      process.exit(0);
    });
    socket.once("timeout", () => fail(`Timed out connecting to ${host}:${port}`));
    socket.once("error", (error) => fail(error.message));
  '; then
    echo "ERROR: Could not connect to the database at ${DATABASE_URL}."
    echo "Make sure Postgres is running and that DATABASE_URL points to a host reachable from this shell."
    exit 1
  fi
}

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

normalize_database_url_for_host
assert_database_reachable

echo ""
echo "─────────────────────────────────────────────"
echo " DB Reset & Migrate"
echo " DATABASE_URL: ${DATABASE_URL%@*}@***"
echo " APP_ENV:      $APP_ENV"
if [[ "$DB_URL_REWRITTEN" -eq 1 ]]; then
  echo " DB Host note: rewrote docker host 'postgres' -> 'localhost' for host-shell execution"
fi
echo "─────────────────────────────────────────────"
echo ""

read -r -p "This will DROP ALL DATA. Continue? [y/N] " confirm

if [[ "$confirm" != [Yy] ]]; then
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
