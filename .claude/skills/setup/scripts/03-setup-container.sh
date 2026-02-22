#!/bin/bash
set -euo pipefail

# 03-build-agent-runner.sh — Build the agent runner subprocess

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/setup.log"

mkdir -p "$PROJECT_ROOT/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [build-agent-runner] $*" >> "$LOG_FILE"; }

log "Building agent runner"

cd "$PROJECT_ROOT/container/agent-runner"

# Install dependencies
BUILD_OK="false"
if npm install >> "$LOG_FILE" 2>&1; then
  log "Agent runner dependencies installed"
else
  log "Agent runner npm install failed"
  cat <<EOF
=== NANOCLAW SETUP: BUILD_AGENT_RUNNER ===
BUILD_OK: false
STATUS: failed
ERROR: npm_install_failed
LOG: logs/setup.log
=== END ===
EOF
  exit 1
fi

# Build TypeScript
if npm run build >> "$LOG_FILE" 2>&1; then
  BUILD_OK="true"
  log "Agent runner build succeeded"
else
  log "Agent runner build failed"
  cat <<EOF
=== NANOCLAW SETUP: BUILD_AGENT_RUNNER ===
BUILD_OK: false
STATUS: failed
ERROR: build_failed
LOG: logs/setup.log
=== END ===
EOF
  exit 1
fi

# Verify output
if [ ! -f "dist/index.js" ]; then
  BUILD_OK="false"
  log "Agent runner dist/index.js not found after build"
fi

STATUS="success"
if [ "$BUILD_OK" = "false" ]; then
  STATUS="failed"
fi

cat <<EOF
=== NANOCLAW SETUP: BUILD_AGENT_RUNNER ===
BUILD_OK: $BUILD_OK
STATUS: $STATUS
LOG: logs/setup.log
=== END ===
EOF

if [ "$STATUS" = "failed" ]; then
  exit 1
fi
