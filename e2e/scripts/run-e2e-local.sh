#!/bin/bash

# E2E Local Test Runner
# Usage: ./scripts/run-e2e-local.sh [playwright options...]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Seed test users before running tests
echo "[e2e] Seeding test users..."
bun __tests__/helpers/e2e-seed.ts

# Run Playwright tests, forwarding all extra args (e.g. --headed, --ui)
echo "[e2e] Running Playwright tests..."
bunx playwright test "$@"
