#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
APP_DIR="$WORKSPACE_ROOT/backend"
STAMP_FILE="$WORKSPACE_ROOT/node_modules/.contentai-backend-deps.sha256"

compute_hash() {
  {
    cat "$WORKSPACE_ROOT/package.json"
    cat "$APP_DIR/package.json"
    cat "$WORKSPACE_ROOT/packages/contracts/package.json"
    cat "$WORKSPACE_ROOT/packages/editor-core/package.json"
    if [ -f "$WORKSPACE_ROOT/bun.lock" ]; then
      cat "$WORKSPACE_ROOT/bun.lock"
    fi
  } | sha256sum | awk '{print $1}'
}

CURRENT_HASH="$(compute_hash)"
SAVED_HASH=""

if [ -f "$STAMP_FILE" ]; then
  SAVED_HASH="$(cat "$STAMP_FILE")"
fi

if [ ! -d "$WORKSPACE_ROOT/node_modules" ] || [ ! -f "$STAMP_FILE" ] || [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
  echo "Installing backend dependencies inside the container..."
  cd "$WORKSPACE_ROOT"
  if [ -f "$WORKSPACE_ROOT/bun.lock" ]; then
    bun install --frozen-lockfile
  else
    bun install
  fi
  printf '%s' "$CURRENT_HASH" > "$STAMP_FILE"
else
  echo "Backend dependencies are up to date."
fi

exec sh "$APP_DIR/scripts/start.sh"
