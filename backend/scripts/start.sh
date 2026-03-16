#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Try a simpler approach using pg_isready if available, otherwise fall back to our Node script
if command -v pg_isready >/dev/null 2>&1; then
  until pg_isready -d "$DATABASE_URL"; do
    echo "  Database not ready — retrying in 2s..."
    sleep 2
  done
else
  # Fallback to Node script but with better error handling
  until bun -e "
    try {
      const { default: postgres } = require('postgres');
      const sql = postgres(process.env.DATABASE_URL, { 
        connect_timeout: 5,
        max: 1 
      });
      await sql\`SELECT 1\`;
      await sql.end();
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  " 2>/dev/null; do
    echo "  Database not ready — retrying in 2s..."
    sleep 2
  done
fi
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
