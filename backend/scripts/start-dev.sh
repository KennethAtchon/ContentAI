#!/bin/sh
set -e

echo "Running database migrations..."
bun run scripts/migrate.ts

echo "Starting development server..."
exec bun run --hot src/index.ts
