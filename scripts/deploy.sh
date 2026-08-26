#!/usr/bin/env bash
# Run manually from inside the production server repository.
# It fast-forwards from origin/main, validates, builds, migrates, reloads PM2,
# and verifies the health endpoint.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
. "$SCRIPT_DIR/_common.sh"
cd "$PROJECT_ROOT"

require_command git
require_command npm
require_command npx
require_command pm2
require_command curl
require_command flock
require_node_20
require_clean_worktree

exec 9>/tmp/clinic-patient-deploy.lock
flock -n 9 || die "Another deployment is already running."

load_production_env
validate_production_env
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

remote="${GIT_REMOTE:-origin}"
branch="${DEPLOY_BRANCH:-main}"
app_name="${PM2_APP_NAME:-clinic-patient}"
host="${HOST:-127.0.0.1}"
port="${PORT:-3000}"
health_url="${HEALTH_URL:-http://127.0.0.1:$port/api/health}"

current_branch="$(git symbolic-ref --quiet --short HEAD)" || die "The server repository is on a detached HEAD."
[ "$current_branch" = "$branch" ] || die "Expected branch '$branch', but the server is on '$current_branch'."

before="$(git rev-parse HEAD)"

log "Fetching $remote/$branch"
git fetch --prune "$remote" "$branch"
target="$(git rev-parse "refs/remotes/$remote/$branch")"

if [ "$before" = "$target" ]; then
  log "Server already has the latest commit"
else
  if ! git merge-base --is-ancestor "$before" "$target"; then
    die "The remote update is not a fast-forward. Resolve it manually; deployment made no changes."
  fi
  log "Fast-forwarding to $target"
  git merge --ff-only "$target"
fi

log "Installing the exact locked dependencies"
npm ci --include=dev

log "Running application checks"
npm run check

log "Checking shipped dependencies for high or critical advisories"
audit_production_deps

log "Building the production application"
npm run build

log "Applying pending database migrations"
npx prisma migrate deploy

if pm2 describe "$app_name" >/dev/null 2>&1; then
  log "Reloading PM2 process: $app_name"
  pm2 reload "$app_name" --update-env
else
  log "Starting PM2 process for the first time: $app_name"
  pm2 start npm --name "$app_name" -- start -- --hostname "$host" --port "$port"
fi
pm2 save

log "Waiting for $health_url"
healthy=false
for _attempt in {1..20}; do
  if curl --fail --silent --show-error "$health_url" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [ "$healthy" != "true" ]; then
  printf 'Deployment reached commit %s, but its health check failed.\n' "$target" >&2
  printf 'Inspect: pm2 logs %s --lines 200\n' "$app_name" >&2
  exit 1
fi

log "Deployment healthy"
printf 'Previous commit: %s\nRunning commit:  %s\n' "$before" "$target"
