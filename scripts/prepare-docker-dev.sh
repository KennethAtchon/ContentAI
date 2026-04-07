#!/usr/bin/env bash
# One-shot prep after clone, image updates, or lockfile changes:
#   - ensure .env files exist (from .env.example)
#   - validate keys (same rules as check-env)
#   - pull infra images + build app images so `docker compose up` has what it needs
#
# Redis "no config file" and Postgres "locale: not found" in container logs are expected for Alpine/dev.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[prepare]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[prepare]${NC} $1"; }
log_error() { echo -e "${RED}[prepare]${NC} $1"; }

INFRA_ONLY=0
SKIP_ENV_CHECK=0
CONNECT_ARGS=()

usage() {
  cat <<'EOF'
Prepare local Docker dev: copy missing .env files, validate config, build Compose images.

Usage: ./scripts/prepare-docker-dev.sh [options]

Options:
  --infra           Only ensure root .env + pull postgres/redis images (no full env check, no app build).
  --skip-env-check  Skip bun check-local-env (still runs copy-env).
  --connect, -c     Pass through to check-local-env (Postgres/Redis must be up).
  -h, --help        Show this help.

Examples:
  ./scripts/prepare-docker-dev.sh
  ./docker-scripts.sh prepare --infra
EOF
}

for arg in "$@"; do
  case "$arg" in
    --infra) INFRA_ONLY=1 ;;
    --skip-env-check) SKIP_ENV_CHECK=1 ;;
    --connect|-c) CONNECT_ARGS+=(--connect) ;;
    -h|--help) usage; exit 0 ;;
    *)
      log_error "Unknown option: $arg"
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  log_error "docker not found in PATH"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  log_error "Docker is not running. Start Docker Desktop (or the daemon), then retry."
  exit 1
fi

log_info "Ensuring .env files from examples (missing targets only)…"
"$ROOT/scripts/copy-env-from-examples.sh"

if [[ "$SKIP_ENV_CHECK" -eq 0 ]]; then
  if [[ "$INFRA_ONLY" -eq 1 ]]; then
    if [[ ! -f "$ROOT/.env" ]]; then
      log_error "Root .env is missing after copy-env — add .env.example as .env"
      exit 1
    fi
    log_info "Skipping backend/frontend secret checks (--infra)."
  else
    if ! command -v bun >/dev/null 2>&1; then
      log_error "bun not found — install Bun to run env validation, or use --skip-env-check"
      exit 1
    fi
    log_info "Validating .env files…"
    if ((${#CONNECT_ARGS[@]} > 0)); then
      bun "$ROOT/backend/scripts/check-local-env.ts" "${CONNECT_ARGS[@]}"
    else
      bun "$ROOT/backend/scripts/check-local-env.ts"
    fi
  fi
fi

if [[ "$INFRA_ONLY" -eq 1 ]]; then
  log_info "Pulling postgres + redis images…"
  docker compose pull postgres redis || log_warn "Some pulls failed (offline?) — continuing."
  log_info "Infra prep done. Start with: ./docker-scripts.sh infra"
  exit 0
fi

log_info "Building backend + frontend images (bun install layers)…"
docker compose build backend frontend

log_info "Done. Start stack with: ./docker-scripts.sh start"
