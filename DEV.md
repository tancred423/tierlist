# Development and Self-Hosting Guide

## Prerequisites

- Docker and Docker Compose

## Development Setup

1. Clone the repository

2. Copy the environment template:
   ```bash
   cp .env.skel .env
   ```

3. Fill in the required values in `.env`:
   - Discord OAuth credentials (create an app at https://discord.com/developers/applications)
   - Set `DISCORD_REDIRECT_URI` to `http://localhost:3000/api/auth/discord/callback`

4. Start the development environment:
   ```bash
   ./dev.sh up:build
   ```

5. Access the services:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - phpMyAdmin: http://localhost:8080

### Dev Commands

Usage: `./dev.sh [command]`
Or: `bash dev.sh [command]`

**Container Management:**
- `up` - Start all containers (without build)
- `up:build` - Start all containers (with build + migrations)
- `down` - Stop all containers
- `purge` - Stop all containers and remove volumes (deletes all data!)
- `restart` - Restart frontend and backend
- `rebuild` - Rebuild and restart frontend and backend

**Logs:**
- `logs` - Show logs for all containers (follow mode)
- `logs:backend` - Show backend logs
- `logs:frontend` - Show frontend logs
- `logs:db` - Show database logs

**Database:**
- `db:migrate` - Run database migrations
- `db:generate` - Generate migration files

**Code Quality:**
- `check` - Run lint, format, and type checks

**Dependencies:**
- `npm:install` - Install frontend dependencies
- `deno:cache` - Cache backend dependencies

**Shell Access:**
- `shell:backend` - Open shell in backend container
- `shell:frontend` - Open shell in frontend container
- `shell:db` - Open MySQL shell

**Status:**
- `status` / `ps` - Show status of all containers

## Self-Hosting (Production)

### Requirements

- Docker and Docker Compose
- External MySQL database (or use the `mysql-network` Docker network)
- Reverse proxy (nginx, Traefik, etc.) for SSL termination

### Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure all environment variables in `.env`:
   - Database connection details
   - JWT secret (generate a secure random string)
   - Discord OAuth credentials
   - Frontend and API URLs for your domain

3. Create the external Docker network if not exists:
   ```bash
   docker network create mysql-network
   ```

4. Start the production stack:
   ```bash
   docker compose up -d
   ```

5. Run database migrations:
   ```bash
   docker exec -it tierlist-backend deno task db:migrate
   ```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `DISCORD_CLIENT_ID` | Discord OAuth application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth application client secret |
| `DISCORD_REDIRECT_URI` | Discord OAuth callback URL |
| `FRONTEND_URL` | Public URL of the frontend |
| `VITE_API_URL` | Public URL of the API |
| `BACKEND_PORT` | Port to expose backend on host (default: 3000) |
| `FRONTEND_PORT` | Port to expose frontend on host (default: 80) |
| `VITE_TERMS_URL` | (Optional) URL to Terms of Service page |
| `VITE_PRIVACY_URL` | (Optional) URL to Privacy Policy page |
| `VITE_SUPPORT_URL` | (Optional) URL to Support/Discord server |
