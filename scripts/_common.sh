#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

log() {
  printf '\n==> %s\n' "$1"
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is missing: $1"
}

require_node_20() {
  require_command node
  local version major minor
  version="$(node -p 'process.versions.node')"
  major="${version%%.*}"
  minor="${version#*.}"
  minor="${minor%%.*}"
  if [ "$major" -ne 20 ] || [ "$minor" -lt 19 ]; then
    die "Node 20.19.x is required; found v$version. Run 'nvm use' if nvm is installed."
  fi
}

require_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    git status --short
    die "The Git worktree must be clean. Commit or intentionally stash your changes first."
  fi
}

load_production_env() {
  local env_file
  env_file="${ENV_FILE:-}"
  if [ -z "$env_file" ]; then
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
      env_file="$PROJECT_ROOT/.env.production"
    else
      env_file="$PROJECT_ROOT/.env"
    fi
  fi
  [ -f "$env_file" ] || die "Environment file not found: $env_file"

  set -a
  # This is a trusted, administrator-managed shell-compatible environment file.
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

# GHSA-ggr8-5vv4-36mx (deepmerge-ts, via @prisma/config -> prisma): every
# current Prisma version pulls this, so npm's only "fix" is downgrading
# prisma to 6.12.0 — there is no forward fix. Exposure is limited to
# build/migrate-time config merging, not patient- or clinic-supplied input.
# Re-run `npm audit --omit=dev --audit-level=high` bare after any dependency
# bump to see whether this can finally be dropped.
ACCEPTED_HIGH_ADVISORIES="GHSA-ggr8-5vv4-36mx"

audit_production_deps() {
  local output status found unexpected
  set +e
  output="$(npm audit --omit=dev --audit-level=high 2>&1)"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    printf '%s\n' "$output"
    return 0
  fi

  found="$(grep -oE 'GHSA-[a-zA-Z0-9-]+' <<<"$output" | sort -u)"
  unexpected="$(comm -23 <(printf '%s\n' "$found") <(printf '%s\n' "$ACCEPTED_HIGH_ADVISORIES" | tr ' ' '\n' | sort -u))"

  if [ -n "$unexpected" ]; then
    printf '%s\n' "$output" >&2
    die "Unallowed high/critical advisories: $(tr '\n' ' ' <<<"$unexpected")"
  fi

  printf '%s\n' "$output"
  log "Only pre-approved advisories present ($ACCEPTED_HIGH_ADVISORIES) — see git log for rationale."
}

validate_production_env() {
  local name
  for name in DATABASE_URL AUTH_SECRET INTEGRATION_API_KEY REPORT_SHARE_ENCRYPTION_KEY PUBLIC_BASE_URL; do
    [ -n "${!name:-}" ] || die "Missing required production variable: $name"
  done
  [ "${#AUTH_SECRET}" -ge 32 ] || die "AUTH_SECRET must be at least 32 characters."
  [ "${#INTEGRATION_API_KEY}" -ge 16 ] || die "INTEGRATION_API_KEY must be at least 16 characters."
  [ "${#REPORT_SHARE_ENCRYPTION_KEY}" -ge 32 ] || die "REPORT_SHARE_ENCRYPTION_KEY must be at least 32 characters."
  [ "$AUTH_SECRET" != "$INTEGRATION_API_KEY" ] || die "AUTH_SECRET and INTEGRATION_API_KEY must differ."
  [ "$AUTH_SECRET" != "$REPORT_SHARE_ENCRYPTION_KEY" ] || die "AUTH_SECRET and REPORT_SHARE_ENCRYPTION_KEY must differ."
  [ "$INTEGRATION_API_KEY" != "$REPORT_SHARE_ENCRYPTION_KEY" ] || die "INTEGRATION_API_KEY and REPORT_SHARE_ENCRYPTION_KEY must differ."
  case "$PUBLIC_BASE_URL" in
    https://*) ;;
    *) die "PUBLIC_BASE_URL must be the canonical HTTPS origin." ;;
  esac
}
