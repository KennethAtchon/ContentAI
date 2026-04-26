#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

cd "$APP_DIR"

echo "=== ContentAI Backend Starting ==="
echo "NODE_ENV: ${NODE_ENV}"
echo "PORT: ${PORT:-3001}"

# Print masked DATABASE_URL for debugging (hide credentials)
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@||' | sed 's|/.*||')
  echo "DATABASE_URL host: $DB_HOST"
else
  echo "ERROR: DATABASE_URL is not set!"
  exit 1
fi

echo "Waiting for database to be ready..."

RETRY=0
MAX_RETRIES=15
DELAY=2

until [ $RETRY -ge $MAX_RETRIES ]; do
  DB_ERROR=$(bun -e "
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL, {
      connect_timeout: 5,
      max: 1,
      ssl: process.env.DATABASE_URL.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    });
    try {
      await sql\`SELECT 1\`;
      await sql.end();
    } catch (err) {
      await sql.end({ timeout: 1 }).catch(() => {});
      throw err;
    }
  " 2>&1)

  if [ $? -eq 0 ]; then
    break
  fi

  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "Database not ready after $MAX_RETRIES attempts — giving up."
    echo "Last error: $DB_ERROR"
    exit 1
  fi

  echo "  Database not ready — retrying in ${DELAY}s... (attempt $RETRY/$MAX_RETRIES)"
  echo "  Error: $DB_ERROR"
  sleep $DELAY
  DELAY=$((DELAY * 2))
  [ $DELAY -gt 30 ] && DELAY=30
done

echo "Database is ready."

echo "Running database migrations..."
bun run scripts/migrate.ts

if [ "${SEED_VOICE_PREVIEWS_ON_BOOT:-false}" = "true" ]; then
  if [ -n "${ELEVENLABS_API_KEY:-}" ] \
    && [ -n "${R2_ACCOUNT_ID:-}" ] \
    && [ -n "${R2_ACCESS_KEY_ID:-}" ] \
    && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] \
    && [ -n "${R2_BUCKET_NAME:-}" ]; then
    echo "Seeding voice previews..."
    bun run scripts/seed-voice-previews.ts
  else
    echo "Skipping voice preview seed: required provider env vars are missing."
  fi
else
  echo "Skipping voice preview seed (set SEED_VOICE_PREVIEWS_ON_BOOT=true to enable)."
fi

if [ "$NODE_ENV" = "development" ]; then
  echo "Starting development server..."
  exec bun run --hot src/index.ts
else
  echo "Starting production server..."
  exec bun dist/index.js
fi
