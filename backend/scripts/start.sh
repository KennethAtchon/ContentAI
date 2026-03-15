#!/bin/sh
set -e

echo "Seeding voice previews..."
bun run scripts/seed-voice-previews.ts

echo "Starting production server..."
exec bun run start
