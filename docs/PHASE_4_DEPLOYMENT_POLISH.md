# Phase 4: Render Deployment Polish

**Goal:** Production-ready deployment on Render with proper start script, monitoring, and persistence guarantees.

**Depends on:** Phases 0-3 (all core functionality working).

**Deliverables:** `scripts/start.sh`, finalised `render.yaml`, `.gitignore`, and a verified deployment pipeline.

---

## Prerequisites

- [ ] Phases 0-3 complete and tested locally
- [ ] Render service created and connected to GitHub
- [ ] All environment variables set in Render dashboard

---

## Steps

### 4.1 Create `scripts/start.sh`

This is the production start script. It handles the persistent disk symlink, workspace syncing, and gateway startup.

```bash
#!/bin/bash
set -e

# --- Persistent Storage Setup ---
OPENCLAW_DATA="/var/data/openclaw"
mkdir -p "$OPENCLAW_DATA"

# Symlink OpenClaw home to persistent disk
if [ ! -L "$HOME/.openclaw" ]; then
  rm -rf "$HOME/.openclaw"
  ln -sf "$OPENCLAW_DATA" "$HOME/.openclaw"
fi

# --- Workspace Sync ---
WORKSPACE="$OPENCLAW_DATA/workspace"
mkdir -p "$WORKSPACE"

# First run: copy all workspace files
if [ ! -f "$WORKSPACE/SOUL.md" ]; then
  echo "First run — initialising workspace..."
  cp -r ./workspace/* "$WORKSPACE/"
fi

# Always sync config (so deploys pick up config changes)
cp ./openclaw.json "$OPENCLAW_DATA/openclaw.json"

# Always sync workspace .md files (so deploys pick up content changes)
# But DON'T overwrite memory, sessions, or user-modified data
for file in SOUL.md AGENTS.md USER.md TOOLS.md IDENTITY.md HEARTBEAT.md; do
  if [ -f "./workspace/$file" ]; then
    cp "./workspace/$file" "$WORKSPACE/$file"
  fi
done

# Always sync skills (so deploys pick up skill changes)
cp -r ./workspace/skills/* "$WORKSPACE/skills/" 2>/dev/null || true

# --- Start Gateway ---
echo "Starting OpenClaw gateway..."
exec npx openclaw gateway start --foreground --verbose
```

**Key design decisions:**
- `exec` replaces the shell process with the gateway — proper signal handling for Render
- Workspace `.md` files are synced on every deploy (your code changes take effect)
- Memory and session files on the persistent disk are NOT overwritten (Jarvis keeps its memory)
- `set -e` ensures any setup failure prevents a broken gateway from starting

### 4.2 Update `render.yaml`

```yaml
services:
  - type: worker
    name: jarvis-gateway
    runtime: node
    plan: starter
    buildCommand: npm install
    startCommand: bash scripts/start.sh
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: GOG_KEYRING_PASSWORD
        sync: false
      - key: GOG_ACCOUNT
        sync: false
      - key: NODE_ENV
        value: production
    disk:
      name: openclaw-data
      mountPath: /var/data/openclaw
      sizeGB: 1
```

**Changes from Phase 0:**
- `startCommand` now uses `bash scripts/start.sh` instead of `npm start`
- All other settings remain the same

### 4.3 Finalise `.gitignore`

```
node_modules/
*.log
.env
.claude/

# Don't commit secrets — they go in Render env vars
credentials/

# OpenClaw runtime data (sessions, memory) stays on persistent disk
.openclaw/
```

### 4.4 Final repository structure

Verify the repo matches this structure:

```
jarvis-openclaw/
├── .gitignore
├── render.yaml
├── package.json
├── openclaw.json
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PHASE_0_RENDER_INFRASTRUCTURE.md
│   ├── PHASE_1_IDENTITY_AND_PERSONA.md
│   ├── PHASE_2_CORE_CONFIGURATION.md
│   ├── PHASE_3_SKILLS_SETUP.md
│   ├── PHASE_4_DEPLOYMENT_POLISH.md
│   ├── PHASE_5_TESTING_AND_ITERATION.md
│   └── PHASE_6_EXTENSIONS.md
├── scripts/
│   └── start.sh
└── workspace/
    ├── SOUL.md
    ├── AGENTS.md
    ├── USER.md
    ├── TOOLS.md
    ├── IDENTITY.md
    ├── HEARTBEAT.md
    ├── lists/
    │   └── shopping.md
    ├── notes/
    │   └── .gitkeep
    └── skills/
        └── household/
            ├── SKILL.md
            └── data/
                └── preferences.json
```

### 4.5 Set environment variables in Render

In the Render dashboard, verify these are set:

| Variable | Value | Notes |
|----------|-------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key |
| `GOG_KEYRING_PASSWORD` | (your password) | Encrypts OAuth tokens at rest |
| `GOG_ACCOUNT` | `your-email@gmail.com` | Google account for gog skill |
| `NODE_ENV` | `production` | Set in render.yaml |

### 4.6 Deploy

```bash
git add .
git commit -m "Phase 4: Deployment polish — start script, render.yaml, .gitignore"
git push origin main
```

Render auto-deploys from `main`. Monitor the deploy in the Render dashboard.

### 4.7 Post-deploy verification

After Render deploys:

1. **Check logs** — Look for:
   - "First run — initialising workspace..." (first deploy only)
   - "Starting OpenClaw gateway..."
   - "Gateway started" or equivalent
   - No error messages

2. **Verify persistent disk:**
   ```bash
   # SSH into Render instance
   render ssh jarvis-gateway
   ls -la /var/data/openclaw/
   ls -la ~/.openclaw  # Should be symlink to /var/data/openclaw
   ```

3. **Verify Telegram connection:**
   - Send a message to the bot on Telegram
   - Check Render logs for incoming message handling
   - If using `dmPolicy: "pairing"`, you'll get a pairing code

4. **Approve pairing:**
   ```bash
   # On Render instance or locally with same config
   npx openclaw pairing approve telegram <code>
   ```

### 4.8 Monitoring setup

**Basic monitoring (included with Render):**
- Render dashboard shows service status, deploy history, and logs
- Set up Render notifications for deploy failures and service restarts

**Optional enhancements:**
- Set up a simple health check: a cron job that sends a test message via Telegram and checks for a response
- Monitor Google Cloud Console for API usage and rate limits
- Set up log alerting for error patterns

---

## Testing

### Deployment pipeline test

1. Make a trivial change to SOUL.md (e.g., add a comment)
2. Commit and push
3. Verify Render redeploys
4. Verify the change is reflected in Jarvis's responses
5. Verify memory and sessions survived the redeploy

### Persistence test

1. Send several messages to Jarvis via Telegram (creates a session)
2. Trigger a Render redeploy
3. After redeploy, verify Jarvis remembers the conversation context
4. Verify shopping list and notes persist

### Recovery test

1. Restart the Render service manually
2. Verify Jarvis comes back online and reconnects to Telegram
3. Verify no data loss

---

## Acceptance Criteria

- [ ] `git push` triggers a Render deploy
- [ ] Gateway starts successfully on Render (no crash loops)
- [ ] `scripts/start.sh` correctly symlinks persistent disk
- [ ] Workspace files sync on deploy
- [ ] Memory and sessions persist across deploys
- [ ] Jarvis responds to Telegram messages
- [ ] Pairing flow works for new users
- [ ] All environment variables are set in Render dashboard
- [ ] `render.yaml` uses `bash scripts/start.sh` as start command

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Start script fails silently | Gateway doesn't start | `set -e` catches errors; check Render logs |
| Symlink already exists as directory | ln -sf fails | Script checks with `[ ! -L ]` before creating |
| Workspace sync overwrites user data | Lost shopping lists/notes | Only sync .md files from repo, not lists/notes |
| Persistent disk full | Gateway can't write | Monitor disk usage; 1GB should be plenty for text |
| Render instance restarts lose env vars | Secrets missing | Env vars persist in Render dashboard (not on disk) |

---

## Commit

```bash
git add scripts/ render.yaml .gitignore
git commit -m "Phase 4: Deployment polish — start script, render.yaml, .gitignore"
```
