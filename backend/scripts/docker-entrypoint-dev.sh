#!/bin/sh
set -eu

STAMP_FILE="/app/node_modules/.contentai-deps.sha256"

compute_hash() {
  cat /app/package.json /app/bun.lock | sha256sum | awk '{print $1}'
}

CURRENT_HASH="$(compute_hash)"
SAVED_HASH=""

if [ -f "$STAMP_FILE" ]; then
  SAVED_HASH="$(cat "$STAMP_FILE")"
fi

if [ ! -d /app/node_modules ] || [ ! -f "$STAMP_FILE" ] || [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
  echo "Installing backend dependencies inside the container..."
  bun install --frozen-lockfile
  printf '%s' "$CURRENT_HASH" > "$STAMP_FILE"
else
  echo "Backend dependencies are up to date."
fi

exec sh /app/scripts/start.sh
