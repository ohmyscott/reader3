#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
TEST_IMAGE="reader3:test"
TEST_CONTAINER="reader3-test"
TEST_PORT="8124"
BOOKS_DIR="${BOOKS_DIR:-./books}"

print_status "Reader3 Docker Deployment Test"
echo "======================================"

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    if docker ps -q -f name="$TEST_CONTAINER" | grep -q .; then
        docker stop "$TEST_CONTAINER" >/dev/null 2>&1 || true
    fi
    if docker ps -aq -f name="$TEST_CONTAINER" | grep -q .; then
        docker rm "$TEST_CONTAINER" >/dev/null 2>&1 || true
    fi
    if docker images -q "$TEST_IMAGE" | grep -q .; then
        docker rmi "$TEST_IMAGE" >/dev/null 2>&1 || true
    fi
}

# Set trap for cleanup on script exit
trap cleanup EXIT

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running"
    exit 1
fi

# Ensure books directory exists for testing
mkdir -p "$BOOKS_DIR"

# Build Docker image
print_status "Building Docker image..."
if docker build -t "$TEST_IMAGE" .; then
    print_success "Docker build successful!"
else
    print_error "Docker build failed!"
    exit 1
fi

# Create .env file for testing if it doesn't exist
if [[ ! -f ".env" ]] && [[ -f ".env.example" ]]; then
    print_status "Creating .env from .env.example for testing..."
    cp .env.example .env
fi

# Test container startup
print_status "Starting test container..."
docker run -d \
  --name "$TEST_CONTAINER" \
  -p "$TEST_PORT:8123" \
  -v "$(pwd)/$BOOKS_DIR:/app/books" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e BOOKS_DIR=/app/books \
  -e UPLOAD_DIR=/app/uploads \
  --read-only \
  --tmpfs /tmp \
  "$TEST_IMAGE"

if [ $? -eq 0 ]; then
    print_success "Container started successfully!"
else
    print_error "Container startup failed!"
    exit 1
fi

# Wait for container to be ready
print_status "Waiting for service to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f -s http://localhost:$TEST_PORT/api/books >/dev/null 2>&1; then
        print_success "Service is healthy!"
        break
    fi

    if [ $attempt -eq $max_attempts ]; then
        print_error "Service health check failed after $max_attempts attempts!"
        print_status "Container logs:"
        docker logs "$TEST_CONTAINER"
        exit 1
    fi

    echo -n "."
    sleep 2
    ((attempt++))
done

# Test API endpoints
print_status "Testing API endpoints..."

# Test books endpoint
if curl -f -s http://localhost:$TEST_PORT/api/books >/dev/null; then
    print_success "Books API endpoint working"
else
    print_warning "Books API endpoint failed"
fi

# Test root endpoint
if curl -f -s http://localhost:$TEST_PORT/ >/dev/null; then
    print_success "Root endpoint working"
else
    print_warning "Root endpoint failed"
fi

# Test docs endpoint (if available)
if curl -f -s http://localhost:$TEST_PORT/docs >/dev/null; then
    print_success "API documentation endpoint working"
else
    print_warning "API documentation endpoint not available"
fi

# Show container information
print_status "Container information:"
echo "- Container ID: $(docker ps -q -f name="$TEST_CONTAINER")"
echo "- Image: $TEST_IMAGE"
echo "- Port: $TEST_PORT"
echo "- Books volume: $BOOKS_DIR"

# Show resource usage
print_status "Resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" "$TEST_CONTAINER" 2>/dev/null || echo "Resource stats not available"

# Show recent logs
print_status "Recent container logs:"
docker logs --tail 10 "$TEST_CONTAINER"

print_success "Docker test completed successfully!"
print_status "Container is running at: http://localhost:$TEST_PORT"

# Note: Container will be automatically cleaned up by trap on exit