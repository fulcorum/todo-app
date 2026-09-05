#!/usr/bin/env bash
# PreToolUse (Edit|Write): before/ is the frozen baseline for the video series.
set -euo pipefail

path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

case "$path" in
  */before/*|before/*)
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "before/ is the frozen baseline for the video series. Make the change in after/ instead."
      }
    }'
    ;;
esac
