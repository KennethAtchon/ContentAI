#!/bin/sh
set -e

echo "Waiting for database to be ready..."
until bun -e "
  const net = require('net');
  const url = new URL(process.env.DATABASE_URL);
  const s = net.connect(parseInt(url.port) || 5432, url.hostname);
  s.on('connect', () => { s.destroy(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  echo "  Database not ready — retrying in 2s..."
  sleep 2
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
