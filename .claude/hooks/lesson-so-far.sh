#!/usr/bin/env bash
# Stop: running "lesson so far" counter.
set -uo pipefail

root="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-$PWD}")"
# diff exits 1 whenever the trees differ, which is the normal case here.
lines=$(diff -ru "$root/before" "$root/after" | wc -l | tr -d ' ')

jq -n --arg n "$lines" '{systemMessage: "lesson so far: \($n) diff lines between before/ and after/"}'
