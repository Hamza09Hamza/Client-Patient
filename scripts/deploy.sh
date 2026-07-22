#!/usr/bin/env bash
# Production deploy: install, migrate, build, start.
# Usage: ./scripts/deploy.sh
# Env:   PORT (default 3000), HOST (default 0.0.0.0)
#
# What this does NOT do: seed the database (prisma/seed.ts wipes all tables —
# it refuses to run with NODE_ENV=production unless ALLOW_PROD_SEED=true), or
# provision Postgres/TLS/a reverse proxy for you. See ../DEPLOYMENT.md.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }

export NODE_ENV=production

log "Checking required environment variables"
missing=()
[ -z "${DATABASE_URL:-}" ] && missing+=("DATABASE_URL")
[ -z "${AUTH_SECRET:-}" ] && missing+=("AUTH_SECRET")
[ -z "${INTEGRATION_API_KEY:-}" ] && missing+=("INTEGRATION_API_KEY")
if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing required env vars: ${missing[*]}" >&2
  echo "Set them in the environment or in .env.production, then re-run." >&2
  exit 1
fi
if [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "AUTH_SECRET must be at least 32 characters." >&2
  exit 1
fi
if [ "${#INTEGRATION_API_KEY}" -lt 16 ]; then
  echo "INTEGRATION_API_KEY must be at least 16 characters." >&2
  exit 1
fi

log "Installing dependencies (npm ci)"
npm ci

log "Generating Prisma client"
npx prisma generate

log "Applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

log "Building the production bundle"
npm run build

PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
log "Starting the server on ${HOST}:${PORT}"
exec npx next start --hostname "$HOST" --port "$PORT"
