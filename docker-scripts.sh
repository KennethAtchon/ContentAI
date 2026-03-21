#!/bin/bash

# Docker Development Scripts for WebsiteTemplate2

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

# Main commands
case "${1:-help}" in
    "start")
        check_docker
        if [ "${2:-}" = "--infra" ] || [ "${2:-}" = "infra" ]; then
            log_info "Starting infrastructure (Postgres, Redis) only..."
            start_infra_only
        else
            log_info "Starting Docker services..."
            if check_env; then
                docker compose up -d --build
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
        docker compose down
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
        docker compose build
        log_info "Build completed."
        ;;
    
    "clean")
        log_warn "This will remove ALL Docker resources including containers, images, volumes, networks, and build cache. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log_info "Cleaning up ALL Docker resources..."
            
            # Stop and remove all containers
            log_info "Stopping and removing all containers..."
            docker stop $(docker ps -aq) 2>/dev/null || true
            docker rm $(docker ps -aq) 2>/dev/null || true
            
            # Remove all images
            log_info "Removing all Docker images..."
            docker rmi $(docker images -q) 2>/dev/null || true
            docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
            
            # Remove all volumes
            log_info "Removing all Docker volumes..."
            docker volume rm $(docker volume ls -q) 2>/dev/null || true
            
            # Remove all networks
            log_info "Removing all Docker networks..."
            docker network rm $(docker network ls -q) 2>/dev/null || true
            
            # Clean up system
            log_info "Cleaning up Docker system..."
            docker system prune -af --volumes
            
            # Remove compose-specific resources
            log_info "Removing compose-specific resources..."
            docker compose down -v --remove-orphans 2>/dev/null || true
            
            log_info "Complete cleanup finished. All Docker resources removed."
        else
            log_info "Cleanup cancelled."
        fi
        ;;
    
    "production")
        log_info "Starting production services with nginx..."
        check_docker
        if check_env; then
            NODE_ENV=production docker compose --profile production up -d
            log_info "Production services started. Access via http://localhost"
        else
            log_error "Please configure .env file first."
        fi
        ;;
    
    "status")
        log_info "Service status:"
        docker compose ps
        ;;
    
    "help"|*)
        echo "Docker Development Scripts for WebsiteTemplate2"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start          - Start all development services"
        echo "  start --infra  - Start Postgres and Redis only (same as: infra)"
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
        echo "  production     - Start production services with nginx"
        echo "  status         - Show service status"
        echo "  help           - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start development environment"
        echo "  $0 infra                    # DB + Redis only (run app with bun dev)"
        echo "  $0 migrate                  # Run database migrations"
        echo "  $0 production               # Start production environment"
        ;;
esac
