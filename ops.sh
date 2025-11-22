#!/bin/bash

# Reader3 Operations Script

set -e

# Check if terminal supports colors and set color variables
check_color_support() {
    if [[ -t 1 && -n "${TERM:-}" && "${TERM}" != "dumb" ]]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        PURPLE='\033[0;35m'
        CYAN='\033[0;36m'
        BOLD='\033[1m'
        NC='\033[0m'
        USE_COLORS=true
    else
        RED=""
        GREEN=""
        YELLOW=""
        BLUE=""
        PURPLE=""
        CYAN=""
        BOLD=""
        NC=""
        USE_COLORS=false
    fi
}

# Initialize colors
check_color_support

# Configuration
PROJECT_NAME="Reader3"
DEFAULT_PORT="8123"
DEV_HOST="0.0.0.0"
PYTHON_SCRIPT="server.py"
BOOKS_DIR="${BOOKS_DIR:-./books}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
PID_FILE=".dev_server.pid"

print_header() {
    printf "${PURPLE}================================${NC}\n"
    printf "${PURPLE}  Reader3 Operations${NC}\n"
    printf "${PURPLE}================================${NC}\n"
}

print_section() {
    printf "\n${BLUE}--- $1 ---${NC}\n"
}

print_success() {
    printf "${GREEN}✅ $1${NC}\n"
}

print_error() {
    printf "${RED}❌ $1${NC}\n"
}

print_warning() {
    printf "${YELLOW}⚠️  $1${NC}\n"
}

print_info() {
    printf "${CYAN}ℹ️  $1${NC}\n"
}

check_project_dir() {
    if [[ ! -f "$PYTHON_SCRIPT" ]]; then
        print_error "This is not a Reader3 project directory. Missing $PYTHON_SCRIPT"
        exit 1
    fi
}

show_usage() {
    print_header
    cat << 'EOF'
Usage: ./ops.sh [ENVIRONMENT] COMMAND

ENVIRONMENTS:
  dev     Development environment (default)
  prod    Production environment (Docker)

COMMANDS:
  start   Start the service
  stop    Stop the service
  restart Restart the service
  ps      Show service status and process info
  ls      Show EPUB files and data statistics
  clean   Clean old EPUB and _data files (LRU strategy)
  build   Build Docker images (prod only)
  help    Show this help message

EXAMPLES:
  ./ops.sh dev start     # Start dev environment
  ./ops.sh prod start    # Start prod environment
  ./ops.sh ls            # Show file statistics
  ./ops.sh prod build    # Build prod Docker images
  ./ops.sh clean lru     # Clean old files (keep 10 most recent)
  ./ops.sh clean lru 5   # Clean old files (keep 5 most recent)
EOF
}

dev_start() {
    print_section "Starting Development Environment"

    # Check if already running
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Development server is already running (PID: $pid)"
            return 0
        else
            print_info "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi

    # Ensure directories exist
    mkdir -p "$BOOKS_DIR" "$UPLOADS_DIR"

    # Set environment variables
    export BOOKS_DIR="$BOOKS_DIR"
    export UPLOADS_DIR="$UPLOADS_DIR"
    export HOST="$DEV_HOST"
    export PORT="$DEFAULT_PORT"

    print_info "Starting server on $DEV_HOST:$DEFAULT_PORT"
    print_info "Books directory: $BOOKS_DIR"
    print_info "Uploads directory: $UPLOADS_DIR"

    # Start the server in background
    nohup uv run python "$PYTHON_SCRIPT" > /dev/null 2>&1 &
    local pid=$!

    # Save PID
    echo "$pid" > "$PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        print_success "Development server started successfully (PID: $pid)"
        print_info "Access at: http://$DEV_HOST:$DEFAULT_PORT"
    else
        print_error "Failed to start development server"
        rm -f "$PID_FILE"
        exit 1
    fi
}

dev_stop() {
    print_section "Stopping Development Environment"

    if [[ ! -f "$PID_FILE" ]]; then
        print_warning "Development server is not running (no PID file)"
        return 0
    fi

    local pid=$(cat "$PID_FILE")

    if kill -0 "$pid" 2>/dev/null; then
        print_info "Stopping development server (PID: $pid)"
        kill "$pid"

        # Wait for process to stop
        local count=0
        while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
            sleep 1
            ((count++))
        done

        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Force killing development server"
            kill -9 "$pid"
        fi

        rm -f "$PID_FILE"
        print_success "Development server stopped"
    else
        print_warning "Development server was not running (stale PID file)"
        rm -f "$PID_FILE"
    fi
}

dev_restart() {
    print_section "Restarting Development Environment"
    dev_stop
    sleep 1
    dev_start
}

dev_ps() {
    print_section "Development Environment Status"

    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            print_success "Development server is RUNNING"
            echo "  PID:       $pid"
            echo "  Command:   $(ps -p "$pid" -o args=)"
            echo "  Memory:    $(ps -p "$pid" -o rss= | awk '{printf "%.1f MB", $1/1024}')"
            echo "  CPU:       $(ps -p "$pid" -o %cpu=)%"
            echo "  Uptime:    $(ps -p "$pid" -o etime=)"
            echo "  Port:      $DEFAULT_PORT"
            echo "  Host:      $DEV_HOST"
        else
            print_error "Development server is NOT running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        print_warning "Development server is NOT running"
    fi
}

prod_start() {
    print_section "Starting Production Environment"

    # Check Docker and Docker Compose
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    # Check required files
    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found"
        exit 1
    fi

    if [[ ! -f "Dockerfile" ]]; then
        print_error "Dockerfile not found"
        exit 1
    fi

    # Ensure directories exist
    mkdir -p "$BOOKS_DIR" "$UPLOADS_DIR"

    print_info "Starting Docker containers..."

    # Use docker-compose if available, otherwise docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi

    print_success "Production environment started"
    print_info "Access at: http://localhost:$DEFAULT_PORT"
}

prod_stop() {
    print_section "Stopping Production Environment"

    # Use docker-compose if available, otherwise docker compose
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps -q | grep -q .; then
            docker-compose down
            print_success "Production environment stopped"
        else
            print_warning "Production environment is not running"
        fi
    else
        if docker compose ps -q | grep -q .; then
            docker compose down
            print_success "Production environment stopped"
        else
            print_warning "Production environment is not running"
        fi
    fi
}

prod_restart() {
    print_section "Restarting Production Environment"
    prod_stop
    sleep 2
    prod_start
}

prod_ps() {
    print_section "Production Environment Status"

    # Use docker-compose if available, otherwise docker compose
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps | grep -q "Up"; then
            print_success "Production containers are RUNNING"
            echo ""
            echo "Container Details:"
            docker-compose ps
        else
            print_warning "Production environment is NOT running"
        fi
    else
        if docker compose ps | grep -q "Up"; then
            print_success "Production containers are RUNNING"
            echo ""
            echo "Container Details:"
            docker compose ps
        else
            print_warning "Production environment is NOT running"
        fi
    fi
}

prod_build() {
    print_section "Building Production Environment"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if [[ ! -f "Dockerfile" ]]; then
        print_error "Dockerfile not found"
        exit 1
    fi

    print_info "Building Docker image..."
    docker build -t reader3 .

    print_success "Docker image built successfully"
}

show_files() {
    print_section "EPUB Files and Data Statistics"

    if [[ "$USE_COLORS" == "true" ]]; then
        # Colored version
        printf "\n"
        printf "${CYAN}Directory Information:${NC}\n"
        printf "  Books Directory: $BOOKS_DIR\n"
        printf "  Uploads Directory: $UPLOADS_DIR\n"

        # Check books directory
        if [[ -d "$BOOKS_DIR" ]]; then
            local book_count=$(find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | wc -l)
            local books_size=$(du -sh "$BOOKS_DIR" 2>/dev/null | cut -f1)

            printf "\n"
            printf "${CYAN}Books Data:${NC}\n"
            printf "  Processed Books: $book_count\n"
            printf "  Total Size: $books_size\n"

            if [[ $book_count -gt 0 ]]; then
                printf "\n"
                printf "${CYAN}Book Details:${NC}\n"
                find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | while read -r book_dir; do
                    local book_name=$(basename "$book_dir" "_data")
                    local book_size=$(du -sh "$book_dir" 2>/dev/null | cut -f1)
                    local chapter_count=$(find "$book_dir" -name "*.json" 2>/dev/null | wc -l)
                    local image_count=$(find "$book_dir/images" -type f 2>/dev/null | wc -l)

                    printf "    📚 $book_name\n"
                    printf "       Size: $book_size | Chapters: $chapter_count | Images: $image_count\n"
                done
            fi
        else
            printf "\n"
            printf "${YELLOW}Books directory does not exist: $BOOKS_DIR${NC}\n"
        fi

        # Check uploads directory
        printf "\n"
        printf "${CYAN}Uploaded Files:${NC}\n"
        if [[ -d "$UPLOADS_DIR" ]]; then
            local upload_count=$(find "$UPLOADS_DIR" -name "*.epub" -type f | wc -l)
            local uploads_size=$(du -sh "$UPLOADS_DIR" 2>/dev/null | cut -f1)

            printf "  EPUB Files: $upload_count\n"
            printf "  Total Size: $uploads_size\n"

            if [[ $upload_count -gt 0 ]]; then
                printf "\n"
                printf "${CYAN}Upload Details:${NC}\n"
                find "$UPLOADS_DIR" -name "*.epub" -type f | while read -r epub_file; do
                    local file_name=$(basename "$epub_file")
                    local file_size=$(du -sh "$epub_file" 2>/dev/null | cut -f1)
                    local file_date=$(date -r "$epub_file" "+%Y-%m-%d %H:%M" 2>/dev/null)

                    printf "    📤 $file_name\n"
                    printf "       Size: $file_size | Uploaded: $file_date\n"
                done
            fi
        else
            printf "  Uploads directory does not exist: $UPLOADS_DIR\n"
        fi
    else
        # Plain text version
        printf "\n"
        printf "Directory Information:\n"
        printf "  Books Directory: $BOOKS_DIR\n"
        printf "  Uploads Directory: $UPLOADS_DIR\n"

        # Check books directory
        if [[ -d "$BOOKS_DIR" ]]; then
            local book_count=$(find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | wc -l)
            local books_size=$(du -sh "$BOOKS_DIR" 2>/dev/null | cut -f1)

            printf "\n"
            printf "Books Data:\n"
            printf "  Processed Books: $book_count\n"
            printf "  Total Size: $books_size\n"

            if [[ $book_count -gt 0 ]]; then
                printf "\n"
                printf "Book Details:\n"
                find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | while read -r book_dir; do
                    local book_name=$(basename "$book_dir" "_data")
                    local book_size=$(du -sh "$book_dir" 2>/dev/null | cut -f1)
                    local chapter_count=$(find "$book_dir" -name "*.json" 2>/dev/null | wc -l)
                    local image_count=$(find "$book_dir/images" -type f 2>/dev/null | wc -l)

                    printf "    BOOK: $book_name\n"
                    printf "       Size: $book_size | Chapters: $chapter_count | Images: $image_count\n"
                done
            fi
        else
            printf "\n"
            printf "WARNING: Books directory does not exist: $BOOKS_DIR\n"
        fi

        # Check uploads directory
        printf "\n"
        printf "Uploaded Files:\n"
        if [[ -d "$UPLOADS_DIR" ]]; then
            local upload_count=$(find "$UPLOADS_DIR" -name "*.epub" -type f | wc -l)
            local uploads_size=$(du -sh "$UPLOADS_DIR" 2>/dev/null | cut -f1)

            printf "  EPUB Files: $upload_count\n"
            printf "  Total Size: $uploads_size\n"

            if [[ $upload_count -gt 0 ]]; then
                printf "\n"
                printf "Upload Details:\n"
                find "$UPLOADS_DIR" -name "*.epub" -type f | while read -r epub_file; do
                    local file_name=$(basename "$epub_file")
                    local file_size=$(du -sh "$epub_file" 2>/dev/null | cut -f1)
                    local file_date=$(date -r "$epub_file" "+%Y-%m-%d %H:%M" 2>/dev/null)

                    printf "    FILE: $file_name\n"
                    printf "       Size: $file_size | Uploaded: $file_date\n"
                done
            fi
        else
            printf "  Uploads directory does not exist: $UPLOADS_DIR\n"
        fi
    fi
}

clean_files() {
    local strategy="${2:-lru}"
    local keep_count="${3:-10}"

    print_section "Cleaning Old Files (Strategy: $strategy, Keep: $keep_count)"

    # Validate keep_count is a positive integer
    if ! [[ "$keep_count" =~ ^[0-9]+$ ]] || [[ "$keep_count" -lt 0 ]]; then
        print_error "Keep count must be a positive integer: $keep_count"
        exit 1
    fi

    if [[ "$strategy" != "lru" ]]; then
        print_error "Unsupported cleanup strategy: $strategy (only 'lru' is supported)"
        exit 1
    fi

    local deleted_epubs=0
    local deleted_data_dirs=0
    local freed_space=0

    print_info "Scanning directories..."

    # Clean EPUB files
    if [[ -d "$UPLOADS_DIR" ]]; then
        local epub_count=$(find "$UPLOADS_DIR" -name "*.epub" -type f | wc -l)

        if [[ $epub_count -gt $keep_count ]]; then
            print_info "Found $epub_count EPUB files, keeping $keep_count most recent"

            # Create temp files for tracking deletions
            local temp_file=$(mktemp)
            local temp_counts=$(mktemp)
            echo "0 0" > "$temp_counts"  # deleted_epubs, freed_space

            # Get file modification times and paths (cross-platform)
            find "$UPLOADS_DIR" -name "*.epub" -type f | while read -r file_path; do
                if [[ -f "$file_path" ]]; then
                    local mtime=$(stat -c "%Y" "$file_path" 2>/dev/null || stat -f "%m" "$file_path" 2>/dev/null)
                    echo "$mtime $file_path"
                fi
            done > "$temp_file"

            # Sort by timestamp (oldest first), skip most recent N, and delete
            local total_files=$(sort -n "$temp_file" | wc -l | awk '{print $1}')
            local files_to_delete=$((total_files - keep_count))

            if [[ $files_to_delete -gt 0 ]]; then
                sort -n "$temp_file" | head -n "$files_to_delete" | while read -r timestamp file_path; do
                    if [[ -f "$file_path" ]]; then
                        local file_size=$(du -sb "$file_path" 2>/dev/null | cut -f1)
                        local file_name=$(basename "$file_path")

                        if rm "$file_path" 2>/dev/null; then
                            local current_counts=$(cat "$temp_counts")
                            local deleted=$(echo "$current_counts" | awk '{print $1}')
                            local freed=$(echo "$current_counts" | awk '{print $2}')
                            echo "$((deleted + 1)) $((freed + file_size))" > "$temp_counts"
                            print_info "Deleted EPUB: $file_name ($(echo "$file_size" | awk '{printf "%.1f MB", $1/1024/1024}'))"
                        else
                            print_warning "Failed to delete EPUB: $file_name"
                        fi
                    fi
                done
            fi

            # Read counts back
            local final_counts=$(cat "$temp_counts")
            deleted_epubs=$(echo "$final_counts" | awk '{print $1}')
            freed_space=$(echo "$final_counts" | awk '{print $2}')

            rm -f "$temp_file" "$temp_counts"
        else
            print_info "EPUB files: $epub_count found (within limit of $keep_count)"
        fi
    else
        print_warning "Uploads directory does not exist: $UPLOADS_DIR"
    fi

    # Clean _data directories
    if [[ -d "$BOOKS_DIR" ]]; then
        local data_count=$(find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | wc -l)

        if [[ $data_count -gt $keep_count ]]; then
            print_info "Found $data_count data directories, keeping $keep_count most recent"

            # Create temp files for tracking deletions
            local temp_dir=$(mktemp)
            local temp_dir_counts=$(mktemp)
            echo "0 0" > "$temp_dir_counts"  # deleted_data_dirs, freed_space

            # Get directory modification times and paths (cross-platform)
            find "$BOOKS_DIR" -maxdepth 1 -name "*_data" -type d | while read -r dir_path; do
                if [[ -d "$dir_path" ]]; then
                    local mtime=$(stat -c "%Y" "$dir_path" 2>/dev/null || stat -f "%m" "$dir_path" 2>/dev/null)
                    echo "$mtime $dir_path"
                fi
            done > "$temp_dir"

            # Sort by timestamp (oldest first), skip most recent N, and delete
            local total_dirs=$(sort -n "$temp_dir" | wc -l | awk '{print $1}')
            local dirs_to_delete=$((total_dirs - keep_count))

            if [[ $dirs_to_delete -gt 0 ]]; then
                sort -n "$temp_dir" | head -n "$dirs_to_delete" | while read -r timestamp dir_path; do
                    if [[ -d "$dir_path" ]]; then
                        local dir_name=$(basename "$dir_path")
                        local dir_size=$(du -sb "$dir_path" 2>/dev/null | cut -f1)

                        if rm -rf "$dir_path" 2>/dev/null; then
                            local current_counts=$(cat "$temp_dir_counts")
                            local deleted=$(echo "$current_counts" | awk '{print $1}')
                            local freed=$(echo "$current_counts" | awk '{print $2}')
                            echo "$((deleted + 1)) $((freed + dir_size))" > "$temp_dir_counts"
                            print_info "Deleted data directory: $dir_name ($(echo "$dir_size" | awk '{printf "%.1f MB", $1/1024/1024}'))"
                        else
                            print_warning "Failed to delete data directory: $dir_name"
                        fi
                    fi
                done
            fi

            # Read counts back and add to totals
            local final_counts=$(cat "$temp_dir_counts")
            local deleted_dirs=$(echo "$final_counts" | awk '{print $1}')
            local dir_freed=$(echo "$final_counts" | awk '{print $2}')
            deleted_data_dirs=$((deleted_data_dirs + deleted_dirs))
            freed_space=$((freed_space + dir_freed))

            rm -f "$temp_dir" "$temp_dir_counts"
        else
            print_info "Data directories: $data_count found (within limit of $keep_count)"
        fi
    else
        print_warning "Books directory does not exist: $BOOKS_DIR"
    fi

    # Summary
    print_section "Cleanup Summary"
    if [[ $deleted_epubs -gt 0 || $deleted_data_dirs -gt 0 ]]; then
        print_success "Deleted $deleted_epubs EPUB files and $deleted_data_dirs data directories"
        print_success "Freed space: $(echo "$freed_space" | awk '{printf "%.1f MB", $1/1024/1024}')"
    else
        print_info "No files needed to be deleted"
    fi
}

# Main command handler
main() {
    check_project_dir

    # Parse arguments
    local env="dev"
    local command=""
    local clean_strategy=""
    local clean_keep_count=""

    # Handle clean command with special parsing
    if [[ "$1" == "clean" ]]; then
        command="clean"
        clean_strategy="${2:-lru}"
        clean_keep_count="${3:-10}"
    else
        case "$1" in
            "dev"|"prod")
                env="$1"
                command="$2"
                ;;
            "start"|"stop"|"restart"|"ps"|"ls"|"build"|"help"|"-h"|"--help"|"clean")
                command="$1"
                ;;
            *)
                print_error "Invalid arguments"
                show_usage
                exit 1
                ;;
        esac
    fi

    # Handle empty command
    if [[ -z "$command" ]]; then
        print_error "Missing command"
        show_usage
        exit 1
    fi

    # Execute command
    case "$command" in
        "start")
            if [[ "$env" == "prod" ]]; then
                prod_start
            else
                dev_start
            fi
            ;;
        "stop")
            if [[ "$env" == "prod" ]]; then
                prod_stop
            else
                dev_stop
            fi
            ;;
        "restart")
            if [[ "$env" == "prod" ]]; then
                prod_restart
            else
                dev_restart
            fi
            ;;
        "ps")
            if [[ "$env" == "prod" ]]; then
                prod_ps
            else
                dev_ps
            fi
            ;;
        "ls")
            show_files
            ;;
        "clean")
            clean_files "$command" "$clean_strategy" "$clean_keep_count"
            ;;
        "build")
            if [[ "$env" == "prod" ]]; then
                prod_build
            else
                print_error "Build command is only available for production environment"
                exit 1
            fi
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"