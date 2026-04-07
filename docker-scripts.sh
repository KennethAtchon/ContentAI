#!/bin/bash

# Docker Development Scripts for ReelStudio

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if .env files exist in respective directories
check_env() {
    local missing_env=false
    
    # Check root .env for infrastructure
    if [ ! -f .env ]; then
        log_warn "Root .env file not found. Creating from .env.example..."
        cp .env.example .env
        missing_env=true
    fi
    
    # Check service-specific .env files
    if [ ! -f frontend/.env ]; then
        log_warn "frontend/.env file not found. Creating from frontend/.env.example..."
        cp frontend/.env.example frontend/.env
        missing_env=true
    fi
    
    if [ ! -f backend/.env ]; then
        log_warn "backend/.env file not found. Creating from backend/.env.example..."
        cp backend/.env.example backend/.env
        missing_env=true
    fi
    
    if [ "$missing_env" = true ]; then
        log_warn "Please edit .env (infrastructure), frontend/.env, and backend/.env files with your actual configuration values."
        return 1
    fi
    return 0
}

# Postgres + Redis only (local dev with bun dev)
start_infra_only() {
    docker compose up -d postgres redis
    log_info "Postgres: localhost:5432, Redis: localhost:6379"
}

# Set MOCK_EXTERNALS=1 before calling. Uses docker-compose.dev-mock.yml when enabled.
docker_with_mock() {
    if [ "${MOCK_EXTERNALS:-0}" = 1 ]; then
        docker compose -f docker-compose.yml -f docker-compose.dev-mock.yml "$@"
    else
        docker compose "$@"
    fi
}

# Main commands
case "${1:-help}" in
    "start")
        check_docker
        MOCK_EXTERNALS=0
        START_INFRA=0
        for arg in "${@:2}"; do
            case "$arg" in
                --infra|infra) START_INFRA=1 ;;
                --mock-externals) MOCK_EXTERNALS=1 ;;
                *)
                    log_error "Unknown start option: $arg (use --infra, --mock-externals)"
                    exit 1
                    ;;
            esac
        done
        if [ "$START_INFRA" = 1 ]; then
            if [ "$MOCK_EXTERNALS" = 1 ]; then
                log_warn "--mock-externals applies to the backend container; infra-only start has no backend. Ignoring --mock-externals."
            fi
            log_info "Starting infrastructure (Postgres, Redis) only..."
            start_infra_only
        else
            log_info "Starting Docker services..."
            if check_env; then
                if [ "$MOCK_EXTERNALS" = 1 ]; then
                    log_info "Backend will use DEV_MOCK_EXTERNAL_INTEGRATIONS=true (see docker-compose.dev-mock.yml)."
                fi
                docker_with_mock up -d --build
                log_info "Services started. Frontend: http://localhost:3000, Backend: http://localhost:3001"
            else
                log_error "Please configure .env file first, then run: ./docker-scripts.sh start"
            fi
        fi
        ;;

    "infra")
        log_info "Starting infrastructure (Postgres, Redis) only..."
        check_docker
        start_infra_only
        ;;
    
    "stop")
        log_info "Stopping Docker services..."
        docker compose down --remove-orphans
        log_info "Services stopped."
        ;;
    
    "restart")
        log_info "Restarting Docker services..."
        docker compose restart
        log_info "Services restarted."
        ;;
    
    "logs")
        log_info "Showing logs (Ctrl+C to exit)..."
        docker compose logs -f
        ;;
    
    "migrate")
        log_info "Running database migrations..."
        docker compose exec backend bun run db:migrate
        log_info "Migrations completed."
        ;;
    
    "studio")
        log_info "Opening Drizzle Studio..."
        docker compose exec backend bun run db:studio
        ;;
    
    "shell-backend")
        log_info "Opening backend shell..."
        docker compose exec backend sh
        ;;
    
    "shell-frontend")
        log_info "Opening frontend shell..."
        docker compose exec frontend sh
        ;;
    
    "build")
        log_info "Building Docker images..."
        docker_with_mock build
        log_info "Build completed."
        ;;
    
    "clean")
        log_warn "This will remove the ReelStudio Docker containers, images, networks, and named volumes. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log_info "Cleaning up ReelStudio resources..."
            docker compose down --volumes --remove-orphans --rmi local
            log_info "Project cleanup finished."
        else
            log_info "Cleanup cancelled."
        fi
        ;;
    
    "production")
        log_error "The local Compose stack is development-only now. Build deployment images from backend/Dockerfile and frontend/Dockerfile directly for production-style runs."
        exit 1
        ;;
    
    "status")
        log_info "Service status:"
        docker compose ps
        ;;

    "prepare"|"prep")
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        exec "$SCRIPT_DIR/scripts/prepare-docker-dev.sh" "${@:2}"
        ;;

    "check-env")
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        exec "$SCRIPT_DIR/scripts/check-env.sh" "${@:2}"
        ;;

    "copy-env")
        FORCE_FLAG=()
        for arg in "${@:2}"; do
            case "$arg" in
                --force|-f) FORCE_FLAG=(--force) ;;
                -h|--help)
                    echo "Usage: $0 copy-env [--force]"
                    echo "  Copies all .env.example files to .env (root, backend, frontend)."
                    echo "  Use --force to overwrite existing .env files."
                    exit 0
                    ;;
                *)
                    log_error "Unknown copy-env option: $arg (use --force)"
                    exit 1
                    ;;
            esac
        done
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        exec "$SCRIPT_DIR/scripts/copy-env-from-examples.sh" "${FORCE_FLAG[@]}"
        ;;
    
    "help"|*)
        echo "Docker Development Scripts for ReelStudio"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start          - Start all development services"
        echo "  start --infra  - Start Postgres and Redis only (same as: infra)"
        echo "  start --mock-externals - Start stack with backend DEV_MOCK_EXTERNAL_INTEGRATIONS=true"
        echo "    (bundled MP4/MP3 fixtures + mock scrape; see docker-compose.dev-mock.yml)"
        echo "  infra          - Start Postgres and Redis only"
        echo "  stop           - Stop all services"
        echo "  restart        - Restart all services"
        echo "  logs           - Show logs for all services"
        echo "  migrate        - Run database migrations"
        echo "  studio         - Open Prisma Studio"
        echo "  shell-backend  - Open shell in backend container"
        echo "  shell-frontend - Open shell in frontend container"
        echo "  build          - Build Docker images"
        echo "  clean          - Remove all containers, networks, and volumes"
        echo "  production     - Deprecated (local compose is dev-only; use service Dockerfiles directly)"
        echo "  status         - Show service status"
        echo "  prepare        - After clone or lockfile change: copy-env, validate, build backend/frontend images"
        echo "  prepare --infra - Only root .env + pull postgres/redis (host app with bun dev)"
        echo "  copy-env       - Copy .env.example → .env (root, backend, frontend)"
        echo "  copy-env --force - Same, overwriting existing .env files"
        echo "  check-env      - Validate required keys / formats (after editing .env)"
        echo "  check-env --connect - Same + try Postgres + Redis (must be reachable)"
        echo "  help           - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 prepare                  # First-time / fresh pull: env + image build"
        echo "  $0 start                    # Start development environment"
        echo "  $0 start --mock-externals   # Docker dev with mocked video/TTS/scrape APIs"
        echo "  $0 infra                    # DB + Redis only (run app with bun dev)"
        echo "  $0 migrate                  # Run database migrations"
        echo "  $0 build                    # Build the local development images"
        ;;
esac
