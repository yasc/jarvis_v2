#!/usr/bin/env bash
set -euo pipefail

# ── Render start script for Jarvis (OpenClaw) ──
# Handles persistent storage and starts the gateway.

PERSISTENT_DIR="/var/data/openclaw"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export OPENCLAW_HOME="$PERSISTENT_DIR"
export NODE_PATH="$REPO_DIR/node_modules"
export NODE_OPTIONS="--max-old-space-size=1536"

echo "==> OPENCLAW_HOME=$OPENCLAW_HOME"
echo "==> Repo dir: $REPO_DIR"

# Ensure persistent directory structure exists
mkdir -p "$OPENCLAW_HOME/.openclaw"

# Sync openclaw.json from repo to where OpenClaw actually reads it
if [ -f "$REPO_DIR/openclaw.json" ]; then
  cp "$REPO_DIR/openclaw.json" "$OPENCLAW_HOME/.openclaw/openclaw.json"
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

# Copy icloud-calendar script into its skill directory so {baseDir} resolves
cp "$REPO_DIR/scripts/icloud-calendar.mjs" "$OPENCLAW_HOME/.openclaw/workspace/skills/icloud-calendar/"
echo "==> Copied icloud-calendar.mjs to skill dir"

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

# Generate a gateway auth token if not already persisted (must happen before config set)
TOKEN_FILE="$OPENCLAW_HOME/.openclaw/gateway-token"
if [ ! -f "$TOKEN_FILE" ]; then
  openssl rand -hex 32 > "$TOKEN_FILE"
  echo "==> Generated new gateway token"
fi
export OPENCLAW_GATEWAY_TOKEN="$(cat "$TOKEN_FILE")"

# Set gateway mode and model config via CLI to ensure they persist
echo "==> Setting gateway.mode=local..."
npx openclaw config set gateway.mode local
echo "==> Setting model config..."
npx openclaw config set agents.defaults.model.primary "anthropic/claude-sonnet-4-5"
npx openclaw config set agents.defaults.thinkingDefault "low"

# Ensure reminders data file exists
DATA_DIR="$OPENCLAW_HOME/.openclaw/workspace/data"
mkdir -p "$DATA_DIR"
if [ ! -f "$DATA_DIR/reminders.json" ]; then
  echo '{"reminders":[]}' > "$DATA_DIR/reminders.json"
  echo "==> Created empty reminders.json"
fi

# Start background services
echo "==> Starting reminder checker..."
node "$REPO_DIR/scripts/check-reminders.mjs" &
CHECKER_PID=$!

echo "==> Starting morning briefing scheduler..."
node "$REPO_DIR/scripts/morning-briefing.mjs" &
BRIEFING_PID=$!

# Cleanup on exit
cleanup() {
  echo "==> Stopping background services..."
  kill "$CHECKER_PID" 2>/dev/null || true
  kill "$BRIEFING_PID" 2>/dev/null || true
  wait "$CHECKER_PID" 2>/dev/null || true
  wait "$BRIEFING_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting OpenClaw gateway..."
npx openclaw gateway --verbose
