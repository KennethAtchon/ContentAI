#!/usr/bin/env bash
# Copy all `.env.example` files to `.env` (repo root, backend, frontend).
# Usage:
#   ./scripts/copy-env-from-examples.sh           # copy only if destination is missing
#   ./scripts/copy-env-from-examples.sh --force   # overwrite existing .env files

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    -h|--help)
      echo "Usage: $0 [--force]"
      echo "  Copies .env.example → .env, backend/.env.example → backend/.env,"
      echo "  frontend/.env.example → frontend/.env"
      echo "  Without --force, skips targets that already exist."
      exit 0
      ;;
  esac
done

copy_one() {
  local src=$1
  local dest=$2
  if [[ ! -f "$src" ]]; then
    echo "error: missing $src" >&2
    exit 1
  fi
  if [[ -f "$dest" && "$FORCE" -eq 0 ]]; then
    echo "skip: $dest already exists (use --force to overwrite)"
    return 0
  fi
  cp "$src" "$dest"
  echo "wrote $dest"
}

copy_one .env.example .env
copy_one backend/.env.example backend/.env
copy_one frontend/.env.example frontend/.env
