#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-$(pwd)}"
STAMP_FILE="$APP_DIR/node_modules/.contentai-deps.sha256"

compute_hash() {
  cat "$APP_DIR/package.json" "$APP_DIR/bun.lock" | sha256sum | awk '{print $1}'
}

CURRENT_HASH="$(compute_hash)"
SAVED_HASH=""

if [ -f "$STAMP_FILE" ]; then
  SAVED_HASH="$(cat "$STAMP_FILE")"
fi

if [ ! -d "$APP_DIR/node_modules" ] || [ ! -f "$STAMP_FILE" ] || [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
  echo "Installing frontend dependencies inside the container..."
  bun install --frozen-lockfile
  printf '%s' "$CURRENT_HASH" > "$STAMP_FILE"
else
  echo "Frontend dependencies are up to date."
fi

echo "Starting Vite dev server..."
exec bun run dev
