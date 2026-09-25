#!/bin/sh
# Optional developer check. Read-only; not a setup or repair step.
set -eu
TASK_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$TASK_SCRIPT_DIR/check-client-state.cjs" "$@"
