#!/usr/bin/env bash
# Read-only production diagnostics. Run from inside the server repository.

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
. "$SCRIPT_DIR/_common.sh"
cd "$PROJECT_ROOT"

require_command git
require_command pm2
require_command curl
require_command npx
load_production_env
export NODE_ENV=production

app_name="${PM2_APP_NAME:-clinic-patient}"
port="${PORT:-3000}"
health_url="${HEALTH_URL:-http://127.0.0.1:$port/api/health}"

# Diagnostics should continue so one failure does not hide the remaining state.
set +e

log "Repository"
git status --short --branch
git log -1 --format='commit: %H%nsubject: %s%ndate: %cI'

log "PM2"
pm2 describe "$app_name"

log "Application health"
curl --fail --silent --show-error "$health_url"
printf '\n'

log "Database migration status"
npx prisma migrate status

log "Report storage"
df -h "$PROJECT_ROOT/uploads"
