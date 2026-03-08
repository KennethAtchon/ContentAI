#!/bin/bash

# E2E Docker Test Runner
# Usage: ./scripts/run-e2e-docker.sh [command]

set -e

echo "🐳 Running E2E tests in Docker container..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    print_error "Docker or Docker Compose is not installed"
    exit 1
fi

# Determine which command to use
DOCKER_CMD="docker compose"
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
fi

# Build and start services, waiting until all health checks pass
print_status "Building and starting required services..."
$DOCKER_CMD up -d --wait postgres redis backend frontend

# Build the e2e image separately so frontend/backend containers aren't recreated.
# --no-cache ensures all changed test files and config are picked up.
print_status "Building E2E test image..."
$DOCKER_CMD --profile e2e build --no-cache e2e-tests

# Run the E2E tests
print_status "Running E2E tests..."

# Handle different commands
case "${1:-test}" in
    "test")
        $DOCKER_CMD --profile e2e run --rm --no-deps e2e-tests bunx playwright test
        ;;
    "seed")
        $DOCKER_CMD --profile e2e run --rm --no-deps e2e-tests bun __tests__/helpers/e2e-seed.ts
        ;;
    "shell")
        $DOCKER_CMD --profile e2e run --rm --no-deps e2e-tests sh
        ;;
    "build")
        $DOCKER_CMD --profile e2e build e2e-tests
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Available commands:"
        echo "  test  - Run E2E tests (default)"
        echo "  seed  - Run database seeding"
        echo "  shell - Open shell in E2E container"
        echo "  build - Build E2E container"
        exit 1
        ;;
esac

# Cleanup
print_status "Cleaning up..."
$DOCKER_CMD stop postgres redis backend frontend 2>/dev/null || true

print_status "E2E tests completed!"
