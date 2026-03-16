#!/bin/sh
set -e

echo "Waiting for database to be ready..."

RETRY=0
MAX_RETRIES=15
DELAY=2

until [ $RETRY -ge $MAX_RETRIES ]; do
  if bun -e "
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 5, max: 1 });
    await sql\`SELECT 1\`;
    await sql.end();
  " 2>/dev/null; then
    break
  fi

  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "Database not ready after $MAX_RETRIES attempts — giving up."
    exit 1
  fi

  echo "  Database not ready — retrying in ${DELAY}s... (attempt $RETRY/$MAX_RETRIES)"
  sleep $DELAY
  DELAY=$((DELAY * 2))
  [ $DELAY -gt 30 ] && DELAY=30
done

echo "Database is ready."

echo "Running database migrations..."
bun run scripts/migrate.ts

echo "Seeding voice previews..."
bun run scripts/seed-voice-previews.ts

# Check if we're in development mode
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting development server..."
  exec bun run --hot src/index.ts
else
  echo "Starting production server..."
  exec bun run start
fi
