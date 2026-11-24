#!/usr/bin/env bash
# Sync this fork with upstream, on the schedule you choose.
#
# Usage:
#   config/scripts/git/upstream-sync/sync-upstream.sh status     # what moved, grouped by area you care about
#   config/scripts/git/upstream-sync/sync-upstream.sh log        # commits affecting the plumbing layers
#   config/scripts/git/upstream-sync/sync-upstream.sh merge      # merge upstream/main into the current branch
#   config/scripts/git/upstream-sync/sync-upstream.sh cherry SHA # take one upstream commit
#
# The plumbing layers (src/shared, src/preload, protocol) are where upstream
# spends most of its commits and where you want its fixes. The renderer is
# yours; read it, do not merge it blindly.
set -euo pipefail

PLUMBING=(src/shared src/preload src/main/runtime/rpc src/remote-runtime)
TAG_REF="${UPSTREAM_REF:-upstream/main}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }
}
need git

git rev-parse --verify "$TAG_REF" >/dev/null 2>&1 || {
  echo "no $TAG_REF; run: git remote add upstream https://github.com/stablyai/orca.git && git fetch upstream" >&2
  exit 1
}

branch=$(git rev-parse --abbrev-ref HEAD)
case "${1:-status}" in
  status)
    echo "branch: $branch   upstream: $TAG_REF"
    behind=$(git rev-list --count "HEAD..$TAG_REF")
    echo "commits behind: $behind"
    if [ "$behind" -gt 0 ]; then
      echo
      echo "plumbing changes you probably want:"
      git log --oneline "HEAD..$TAG_REF" -- "${PLUMBING[@]}" | head -25
      echo
      echo "renderer changes (yours to accept or ignore):"
      git log --oneline "HEAD..$TAG_REF" -- src/renderer | head -15
    fi
    ;;
  log)
    git log --oneline "HEAD..$TAG_REF" -- "${PLUMBING[@]}"
    ;;
  merge)
    [ "$branch" != "main" ] || { echo "refusing to merge onto main; main mirrors upstream" >&2; exit 1; }
    git fetch -q upstream --tags
    if git merge --no-commit "$TAG_REF"; then
      echo "clean merge staged. Review, then: git commit"
    else
      echo
      echo "conflicts (expected in the files you edited):"
      git diff --name-only --diff-filter=U
      echo
      echo "resolve, then: git add <files> && git commit"
    fi
    ;;
  cherry)
    [ -n "${2:-}" ] || { echo "usage: $0 cherry <sha>" >&2; exit 1; }
    git cherry-pick "$2"
    ;;
  *)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
