#!/usr/bin/env bash
set -euo pipefail

# ── Render start script for Jarvis (OpenClaw) ──
# Handles persistent storage and starts the gateway.

PERSISTENT_DIR="/var/data/openclaw"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export OPENCLAW_HOME="$PERSISTENT_DIR"
export NODE_OPTIONS="--max-old-space-size=1536"

echo "==> OPENCLAW_HOME=$OPENCLAW_HOME"
echo "==> Repo dir: $REPO_DIR"

# Ensure persistent directory structure exists
mkdir -p "$OPENCLAW_HOME/.openclaw"

# Sync openclaw.json from repo to persistent disk (deploy overwrites)
if [ -f "$REPO_DIR/openclaw.json" ]; then
  cp "$REPO_DIR/openclaw.json" "$OPENCLAW_HOME/openclaw.json"
  echo "==> Synced openclaw.json"
fi

# Sync workspace files to where OpenClaw actually reads them:
# $OPENCLAW_HOME/.openclaw/workspace/
if [ -d "$REPO_DIR/workspace" ]; then
  mkdir -p "$OPENCLAW_HOME/.openclaw/workspace"
  # Copy all workspace files, overwriting defaults
  rsync -av "$REPO_DIR/workspace/" "$OPENCLAW_HOME/.openclaw/workspace/"
  echo "==> Synced workspace to $OPENCLAW_HOME/.openclaw/workspace/"
fi

# Restore gog credentials from persistent disk
if [ -d "$PERSISTENT_DIR/gogcli-config" ]; then
  mkdir -p "$HOME/.config/gogcli"
  cp -r "$PERSISTENT_DIR/gogcli-config/"* "$HOME/.config/gogcli/"
  echo "==> Restored gog credentials"
fi

# Add gog binary to PATH (built from source on persistent disk)
if [ -d "$PERSISTENT_DIR/gogcli/bin" ]; then
  export PATH="$PERSISTENT_DIR/gogcli/bin:$PATH"
  echo "==> gog binary on PATH"
fi

# Set gateway mode and model config via CLI to ensure they persist
echo "==> Setting gateway.mode=local..."
npx openclaw config set gateway.mode local
echo "==> Setting model config..."
npx openclaw config set agents.defaults.model.primary "anthropic/claude-sonnet-4-5"
npx openclaw config set agents.defaults.thinkingDefault "low"

# Generate a gateway auth token if not already persisted
TOKEN_FILE="$OPENCLAW_HOME/.openclaw/gateway-token"
if [ ! -f "$TOKEN_FILE" ]; then
  openssl rand -hex 32 > "$TOKEN_FILE"
  echo "==> Generated new gateway token"
fi
export OPENCLAW_GATEWAY_TOKEN="$(cat "$TOKEN_FILE")"

# Ensure reminders data file exists
DATA_DIR="$OPENCLAW_HOME/.openclaw/workspace/data"
mkdir -p "$DATA_DIR"
if [ ! -f "$DATA_DIR/reminders.json" ]; then
  echo '{"reminders":[]}' > "$DATA_DIR/reminders.json"
  echo "==> Created empty reminders.json"
fi

# Start reminder checker in background
echo "==> Starting reminder checker..."
node "$REPO_DIR/scripts/check-reminders.mjs" &
CHECKER_PID=$!

# Cleanup on exit
cleanup() {
  echo "==> Stopping reminder checker (PID $CHECKER_PID)..."
  kill "$CHECKER_PID" 2>/dev/null || true
  wait "$CHECKER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting OpenClaw gateway..."
npx openclaw gateway --verbose
