#!/usr/bin/env bash
# SessionStart: every episode starts from identical todo data.
set -euo pipefail

root="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-$PWD}")"
source=$(jq -r '.source // "startup"')

# Resume means we are mid-episode -- leave the working data alone.
if [ "$source" = "resume" ]; then
  exit 0
fi

if cmp -s "$root/.claude/seed/db.json" "$root/after/db.json"; then
  exit 0
fi

cp "$root/.claude/seed/db.json" "$root/after/db.json"
jq -n '{systemMessage: "after/db.json restored from seed."}'
