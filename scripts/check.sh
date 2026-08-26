#!/usr/bin/env bash
# Local verification:
#   ./scripts/check.sh             fast checks using installed dependencies
#   ./scripts/check.sh --release   clean install, checks, build, production audit

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
. "$SCRIPT_DIR/_common.sh"
cd "$PROJECT_ROOT"

mode="${1:-}"
if [ -n "$mode" ] && [ "$mode" != "--release" ]; then
  die "Usage: ./scripts/check.sh [--release]"
fi

require_command npm
require_command npx
require_node_20

if [ "$mode" = "--release" ]; then
  log "Installing the exact locked dependency tree"
  npm ci --include=dev
fi

log "Running lint, TypeScript, tests, and Prisma validation"
npm run check

if [ "$mode" = "--release" ]; then
  log "Building the production application"
  npm run build

  log "Checking shipped dependencies for high or critical advisories"
  audit_production_deps
fi

log "Verification passed"
