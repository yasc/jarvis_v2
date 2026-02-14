# Phase 0: Render Infrastructure Setup

**Goal:** Get a bare Render service running OpenClaw before configuring anything.

**Depends on:** Nothing — this is the foundation.

**Deliverables:** A skeleton repo deployed to Render with OpenClaw running and persistent disk mounted.

---

## Prerequisites

- [ ] Node.js >= 22 installed locally
- [ ] A Render account (free tier is fine to start; Starter plan $7/mo for always-on)
- [ ] A GitHub repository created and connected to Render
- [ ] An Anthropic API key (`ANTHROPIC_API_KEY`)

---

## Steps

### 0.1 Initialise the repository

```bash
mkdir jarvis-openclaw && cd jarvis-openclaw
git init
```

Confirm: repo is initialised, no files yet.

### 0.2 Create `package.json`

```json
{
  "name": "jarvis-openclaw",
  "private": true,
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "openclaw": "latest"
  },
  "scripts": {
    "start": "openclaw gateway start --foreground --port $PORT"
  }
}
```

**Open questions to resolve early:**
- Does OpenClaw support the `--port` flag directly? If not, port configuration may need to go in `openclaw.json` or a wrapper script.
- Check OpenClaw docs for `OPENCLAW_HOME` env var support — this affects how we handle persistent storage.

### 0.3 Create `render.yaml`

```yaml
services:
  - type: worker
    name: jarvis-gateway
    runtime: node
    plan: starter
    buildCommand: npm install
    startCommand: npm start
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

**Design decision — Worker vs Web Service:**
- Worker: always-on, no inbound HTTP, cheaper. Ideal for Telegram bot (outbound polling).
- Web Service: needed if we later add WebChat or webhook-based channels.
- **Start with Worker.** Switch to Web Service only if needed.

### 0.4 Handle persistent state

OpenClaw stores sessions, memory, and config under `~/.openclaw/`. Render's filesystem is ephemeral except for the mounted disk at `/var/data/openclaw`.

**Approach:** Symlink `~/.openclaw` to the persistent disk.

```bash
mkdir -p /var/data/openclaw
ln -sf /var/data/openclaw ~/.openclaw
```

This will be formalised in `scripts/start.sh` in Phase 4, but for now validate it manually:
1. SSH into the Render instance (or test locally)
2. Create the symlink
3. Verify OpenClaw writes its state to `/var/data/openclaw`
4. Restart the service and confirm state persists

**Alternative:** If OpenClaw supports `OPENCLAW_HOME` env var, use that instead of symlinking. Check docs first.

### 0.5 Run locally to validate

Before deploying to Render, confirm OpenClaw starts locally:

```bash
npm install
npx openclaw onboard          # First-time setup wizard
npx openclaw gateway --verbose # Run locally
npx openclaw doctor            # Validate config
```

Expected output: Gateway starts, logs show "Gateway started" or similar. It won't do anything useful yet (no channels, no skills configured).

### 0.6 Deploy to Render

```bash
git add package.json render.yaml
git commit -m "Phase 0: Render infrastructure skeleton"
git push origin main
```

In the Render dashboard:
1. Create a new Blueprint from the GitHub repo
2. Verify the `render.yaml` is detected
3. Set `ANTHROPIC_API_KEY` in the Render environment variables
4. Deploy

### 0.7 Verify deployment

Check Render logs for:
- Build completes successfully (`npm install` runs)
- Gateway process starts
- No crash loops
- Persistent disk is mounted at `/var/data/openclaw`

---

## Acceptance Criteria

- [ ] `openclaw gateway` process is running on Render
- [ ] Logs show "Gateway started" (or equivalent startup message)
- [ ] Persistent disk is mounted at `/var/data/openclaw`
- [ ] `~/.openclaw` symlink points to persistent disk
- [ ] No crash loops in Render logs
- [ ] `npm install` and build complete without errors

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `--port $PORT` not supported by OpenClaw | Gateway won't bind to Render's assigned port | Test early; use config file or wrapper script |
| Persistent disk not writable | State lost on redeploy | Verify permissions with `touch /var/data/openclaw/test` |
| OpenClaw version incompatibility | Build fails | Pin to a specific version in `package.json` after testing |

---

## Estimated Effort

Small — mostly boilerplate setup and validation. The main risk is the port binding question, which should be resolved in the first hour.
