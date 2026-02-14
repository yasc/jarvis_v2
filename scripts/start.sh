#!/usr/bin/env bash
set -euo pipefail

# ── Render start script for Jarvis (OpenClaw) ──
# Handles persistent storage and starts the gateway.

PERSISTENT_DIR="/var/data/openclaw"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Use OPENCLAW_HOME to point OpenClaw at the persistent disk.
# This is cleaner than symlinking ~/.openclaw.
export OPENCLAW_HOME="$PERSISTENT_DIR"

echo "==> OPENCLAW_HOME=$OPENCLAW_HOME"
echo "==> Repo dir: $REPO_DIR"

# Ensure persistent directory structure exists
# OpenClaw expects a .openclaw dir inside OPENCLAW_HOME for state
mkdir -p "$OPENCLAW_HOME/.openclaw"

# Sync openclaw.json from repo to persistent disk (deploy overwrites)
if [ -f "$REPO_DIR/openclaw.json" ]; then
  cp "$REPO_DIR/openclaw.json" "$OPENCLAW_HOME/openclaw.json"
  echo "==> Synced openclaw.json"
fi

# Sync workspace files from repo to persistent disk.
# Uses rsync to preserve any runtime-only files (memory, sessions)
# that live on the persistent disk but aren't in git.
if [ -d "$REPO_DIR/workspace" ]; then
  rsync -av --ignore-existing "$REPO_DIR/workspace/" "$OPENCLAW_HOME/workspace/"
  # Overwrite committed workspace files (SOUL.md, AGENTS.md, etc.)
  rsync -av "$REPO_DIR/workspace/" "$OPENCLAW_HOME/workspace/" \
    --include='*.md' --include='*/' --exclude='*'
  echo "==> Synced workspace files"
fi

# Set gateway mode (stored in internal config, not openclaw.json)
echo "==> Setting gateway.mode=local..."
npx openclaw config set gateway.mode local

# Generate a gateway auth token if not already persisted
TOKEN_FILE="$OPENCLAW_HOME/.openclaw/gateway-token"
if [ ! -f "$TOKEN_FILE" ]; then
  openssl rand -hex 32 > "$TOKEN_FILE"
  echo "==> Generated new gateway token"
fi
export OPENCLAW_GATEWAY_TOKEN="$(cat "$TOKEN_FILE")"

echo "==> Starting OpenClaw gateway..."
exec npx openclaw gateway --verbose
