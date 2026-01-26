#!/bin/bash

set -e

COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="tierlist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_help() {
    echo -e "${BLUE}Tierlist - Development Script${NC}"
    echo ""
    echo "Usage: ./dev.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  up              Start all containers (without build)"
    echo "  up:build        Start all containers (with build + migrations)"
    echo "  down            Stop all containers"
    echo "  purge           Stop all containers and remove volumes"
    echo "  restart         Restart frontend and backend"
    echo "  rebuild         Rebuild and restart frontend and backend"
    echo ""
    echo "  logs            Show logs for all containers (follow)"
    echo "  logs:backend    Show backend logs (follow)"
    echo "  logs:frontend   Show frontend logs (follow)"
    echo "  logs:db         Show database logs (follow)"
    echo ""
    echo "  db:migrate      Run database migrations"
    echo "  db:generate     Generate migration files"
    echo ""
    echo "  check           Run lint, format, and type checks"
    echo ""
    echo "  npm:install     Install frontend dependencies"
    echo "  deno:cache      Cache backend dependencies"
    echo ""
    echo "  shell:backend   Open shell in backend container"
    echo "  shell:frontend  Open shell in frontend container"
    echo "  shell:db        Open MySQL shell"
    echo ""
    echo "  status          Show status of all containers"
    echo "  ps              Alias for status"
    echo ""
    echo "  help            Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./dev.sh up:build    # First-time setup or after schema changes"
    echo "  ./dev.sh up          # Start development environment"
    echo "  ./dev.sh logs        # Follow all logs"
    echo "  ./dev.sh check       # Run all checks before committing"
    echo "  ./dev.sh purge       # Reset everything (removes data)"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon is not running${NC}"
        exit 1
    fi
}

wait_for_db() {
    echo -e "${YELLOW}Waiting for database to be ready...${NC}"
    until docker exec tierlist-mysql-dev mysqladmin ping -h localhost --silent 2>/dev/null; do
        sleep 1
    done
    echo -e "${GREEN}Database is ready!${NC}"
}

wait_for_backend() {
    echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
    until docker exec tierlist-backend sh -c "deno --version" 2>/dev/null; do
        sleep 1
    done
    sleep 2
    echo -e "${GREEN}Backend is ready!${NC}"
}

run_migrations() {
    wait_for_db
    wait_for_backend
    echo -e "${YELLOW}Running database migrations...${NC}"
    if docker exec -it tierlist-backend sh -c "deno install && deno task db:migrate"; then
        echo -e "${GREEN}Migrations complete!${NC}"
    else
        echo -e "${RED}Failed to run migrations!${NC}"
        exit 1
    fi
}

case "${1:-help}" in
    up)
        check_docker
        echo -e "${GREEN}Starting development environment...${NC}"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo ""
        echo -e "${GREEN}Services started!${NC}"
        echo -e "  Frontend:   ${BLUE}http://localhost:5173${NC}"
        echo -e "  Backend:    ${BLUE}http://localhost:3000${NC}"
        echo -e "  phpMyAdmin: ${BLUE}http://localhost:8080${NC}"
        echo ""
        echo -e "${YELLOW}Run './dev.sh logs' to see container logs${NC}"
        ;;

    up:build)
        check_docker
        echo -e "${GREEN}Building and starting development environment...${NC}"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up --build -d
        run_migrations
        echo ""
        echo -e "${GREEN}Services started!${NC}"
        echo -e "  Frontend:   ${BLUE}http://localhost:5173${NC}"
        echo -e "  Backend:    ${BLUE}http://localhost:3000${NC}"
        echo -e "  phpMyAdmin: ${BLUE}http://localhost:8080${NC}"
        echo ""
        echo -e "${YELLOW}Run './dev.sh logs' to see container logs${NC}"
        ;;

    down)
        check_docker
        echo -e "${YELLOW}Stopping development environment...${NC}"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        echo -e "${GREEN}Stopped!${NC}"
        ;;

    purge)
        check_docker
        echo -e "${RED}This will remove all containers and volumes (including database data)!${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
            echo -e "${GREEN}Purged!${NC}"
        else
            echo -e "${YELLOW}Cancelled${NC}"
        fi
        ;;

    restart)
        check_docker
        echo -e "${YELLOW}Restarting frontend and backend...${NC}"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME restart backend frontend
        echo -e "${GREEN}Restarted!${NC}"
        ;;

    rebuild)
        check_docker
        echo -e "${YELLOW}Rebuilding frontend and backend...${NC}"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up --build -d --no-deps backend frontend
        echo -e "${GREEN}Rebuilt and started!${NC}"
        ;;

    logs)
        check_docker
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
        ;;

    logs:backend)
        check_docker
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f backend
        ;;

    logs:frontend)
        check_docker
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f frontend
        ;;

    logs:db)
        check_docker
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f mysql
        ;;

    db:migrate)
        check_docker
        wait_for_db
        echo -e "${YELLOW}Running migrations...${NC}"
        docker exec -it tierlist-backend sh -c "deno install && deno task db:migrate"
        echo -e "${GREEN}Migrations complete!${NC}"
        ;;

    db:generate)
        check_docker
        echo -e "${YELLOW}Generating migration files...${NC}"
        docker exec -it tierlist-backend sh -c "deno install && deno task db:generate"
        echo -e "${GREEN}Migrations generated!${NC}"
        ;;

    check)
        check_docker
        echo -e "${BLUE}Running code checks in containers...${NC}"
        echo ""
        
        FAILED=0
        
        echo -e "${YELLOW}[1/4] Linting backend...${NC}"
        if docker exec tierlist-backend deno lint; then
            echo -e "${GREEN}Backend lint passed!${NC}"
        else
            echo -e "${RED}Backend lint failed!${NC}"
            FAILED=1
        fi
        echo ""
        
        echo -e "${YELLOW}[2/4] Type checking backend...${NC}"
        if docker exec tierlist-backend deno check src/main.ts; then
            echo -e "${GREEN}Backend type check passed!${NC}"
        else
            echo -e "${RED}Backend type check failed!${NC}"
            FAILED=1
        fi
        echo ""
        
        echo -e "${YELLOW}[3/4] Linting frontend...${NC}"
        if docker exec tierlist-frontend npm run lint; then
            echo -e "${GREEN}Frontend lint passed!${NC}"
        else
            echo -e "${RED}Frontend lint failed!${NC}"
            FAILED=1
        fi
        echo ""
        
        echo -e "${YELLOW}[4/4] Type checking frontend...${NC}"
        if docker exec tierlist-frontend npx tsc --noEmit; then
            echo -e "${GREEN}Frontend type check passed!${NC}"
        else
            echo -e "${RED}Frontend type check failed!${NC}"
            FAILED=1
        fi
        echo ""
        
        if [ $FAILED -eq 0 ]; then
            echo -e "${GREEN}All checks passed!${NC}"
        else
            echo -e "${RED}Some checks failed!${NC}"
            exit 1
        fi
        ;;

    shell:backend)
        check_docker
        docker exec -it tierlist-backend /bin/sh
        ;;

    shell:frontend)
        check_docker
        docker exec -it tierlist-frontend /bin/sh
        ;;

    shell:db)
        check_docker
        docker exec -it tierlist-mysql-dev mysql -u root -prootpassword tierlist
        ;;

    status|ps)
        check_docker
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
        ;;

    npm:install)
        check_docker
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        docker exec -it tierlist-frontend npm install
        echo -e "${GREEN}Dependencies installed!${NC}"
        ;;

    deno:cache)
        check_docker
        echo -e "${YELLOW}Caching Deno dependencies...${NC}"
        docker exec -it tierlist-backend deno install
        echo -e "${GREEN}Dependencies cached!${NC}"
        ;;

    help|--help|-h)
        print_help
        ;;

    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        print_help
        exit 1
        ;;
esac
