#!/usr/bin/env bash
# Verifies and pushes the current committed branch. It never creates commits.
# Usage: ./scripts/push.sh [--yes]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
. "$SCRIPT_DIR/_common.sh"
cd "$PROJECT_ROOT"

assume_yes=false
if [ "${1:-}" = "--yes" ]; then
  assume_yes=true
elif [ -n "${1:-}" ]; then
  die "Usage: ./scripts/push.sh [--yes]"
fi

require_command git
require_clean_worktree

branch="$(git symbolic-ref --quiet --short HEAD)" || die "Detached HEAD cannot be pushed by this script."
remote="${GIT_REMOTE:-origin}"
git remote get-url "$remote" >/dev/null 2>&1 || die "Git remote does not exist: $remote"

"$SCRIPT_DIR/check.sh" --release
require_clean_worktree

log "Ready to push"
printf 'Remote: %s\nBranch: %s\nCommit: %s\n' \
  "$remote" \
  "$branch" \
  "$(git log -1 --format='%H %s')"

if [ "$assume_yes" != "true" ]; then
  [ -t 0 ] || die "Interactive confirmation is unavailable. Re-run with --yes if intentional."
  read -r -p "Push this commit? [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) die "Push cancelled." ;;
  esac
fi

git push "$remote" "HEAD:refs/heads/$branch"
log "Push completed"
