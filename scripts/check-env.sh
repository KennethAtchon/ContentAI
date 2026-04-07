#!/usr/bin/env bash
# Validate `.env` files (run after copy-env-from-examples + editing).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bun "$ROOT/backend/scripts/check-local-env.ts" "$@"
