# Jarvis on OpenClaw — Implementation Plan

## Recommendation: Start Fresh

Starting fresh is the right call here. OpenClaw replaces the entire custom Python agent harness (the agentic loop, message routing, channel interfaces, session management, daemon lifecycle). Trying to port your existing code into OpenClaw's architecture would mean fighting the framework. Instead, you're porting your **ideas** — the persona, tools, household logic, and guardrails — into OpenClaw's native primitives (workspace files + skills).

What you keep from the old Jarvis: the system prompt content, tool designs, safety guardrails, and family context. What you throw away: the custom agentic loop, the Python interfaces, the conversation persistence layer. OpenClaw handles all of that.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        RENDER                                │
│  Background Worker (always-on)                               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              OpenClaw Gateway (:18789)                  │  │
│  │                                                        │  │
│  │  openclaw.json          Workspace                      │  │
│  │  ├── model config       ├── SOUL.md (Jarvis persona)   │  │
│  │  ├── channel config     ├── AGENTS.md (behaviour rules) │  │
│  │  ├── identity           ├── USER.md (family context)    │  │
│  │  ├── tools config       ├── TOOLS.md (tool guidance)    │  │
│  │  ├── heartbeat          ├── HEARTBEAT.md (proactive)    │  │
│  │  └── security           ├── MEMORY.md (persistent)      │  │
│  │                         └── skills/                     │  │
│  │                              ├── household/SKILL.md     │  │
│  │                              └── ...                    │  │
│  │  Bundled skills:                                        │  │
│  │    gog (Gmail + Calendar + Drive + Contacts)            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Persistent Disk: ~/.openclaw/ (sessions, memory, config)    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    ┌──────┴──┐
                    │Telegram │
                    │  (you   │
                    │ + wife) │
                    └─────────┘
```

---

## Phase 0: Render Infrastructure Setup

**Goal:** Get a bare Render service running OpenClaw before configuring anything.

### 0.1 Create the project repository

```bash
mkdir jarvis-openclaw
cd jarvis-openclaw
git init
```

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

**Note on `$PORT`:** Render assigns a dynamic port via the `PORT` env var. OpenClaw's gateway needs to bind to it. If OpenClaw doesn't support `--port $PORT` directly, we may need a small wrapper script or use the config file to set `gateway.port`. Test this early.

### 0.3 Create `render.yaml` (Infrastructure as Code)

```yaml
services:
  - type: worker
    name: jarvis-gateway
    runtime: node
    plan: starter  # $7/mo, always-on
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false  # set manually in Render dashboard
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

**Why a Worker, not a Web Service?** OpenClaw's gateway is a long-running process that connects to Telegram via its Bot API. It doesn't need to receive inbound HTTP requests from Render's load balancer. A Worker is always-on and cheaper.

**Exception:** If you later want the WebChat interface or webhooks, switch to a Web Service so Render exposes a public URL.

### 0.4 Handle persistent state

OpenClaw stores sessions, memory, and config under `~/.openclaw/`. On Render, the filesystem is ephemeral except for the mounted disk. You need to symlink or configure OpenClaw to use the persistent disk:

```bash
# In a setup script or Dockerfile
mkdir -p /var/data/openclaw
ln -sf /var/data/openclaw ~/.openclaw
```

Or set `OPENCLAW_HOME=/var/data/openclaw` if OpenClaw supports it (check docs). This is **critical** — without it, Jarvis loses all memory and sessions on every deploy.

### 0.5 Deploy and verify

```bash
git add .
git commit -m "Initial Render setup"
git push  # to GitHub, connected to Render
```

Verify in Render logs that the gateway starts and listens. It won't do anything useful yet — that's fine.

**Acceptance criteria:** `openclaw gateway` process is running on Render, logs show "Gateway started", persistent disk is mounted.

---

## Phase 1: Jarvis Identity & Persona

**Goal:** Configure OpenClaw's workspace files to give Jarvis its personality, household context, and behavioural rules.

### 1.1 Create `SOUL.md`

This is Jarvis's personality — who he *is*, not what he does. OpenClaw injects this into the system prompt on every turn.

```markdown
# SOUL.md

You are Jarvis, the household AI assistant for the family.

## Who You Are

You're not a generic chatbot. You're a member of the household — warm, practical, 
and action-oriented. You know the family, their routines, their preferences.

## Your Personality

- **Concise and direct.** Don't over-explain. "Done — reminder set for 3pm" not 
  "I've gone ahead and set a reminder for you at 3:00 PM today."
- **Proactive.** If you notice something relevant (upcoming event, unread school 
  email), mention it naturally.
- **Action-oriented.** When someone asks you to do something, DO IT. Don't describe
  what you would do — call the tools and do it.
- **Appropriately careful.** Important emails get drafted first. Routine stuff just 
  gets done.
- **Match the energy.** Quick question → quick answer. Detailed request → detailed 
  response.

## What You Don't Do

- You never make purchases or financial transactions.
- You never share family information with external parties unless explicitly asked.
- You never pretend to be a family member.
- If you're unsure, you ask.
```

### 1.2 Create `AGENTS.md`

This is the behavioural rulebook — instructions for how Jarvis operates, uses tools, and handles edge cases.

```markdown
# AGENTS.md — Jarvis Operational Instructions

## Tool Usage Rules

- When asked to do something, use your tools to actually do it. Never just 
  describe what you could do.
- If a task requires multiple steps (e.g., "email John about Saturday dinner"), 
  gather all needed info first (check calendar, look up contact), then act.
- If you're missing information (like an email address), ask the user directly. 
  Don't guess.

## Email Rules (Gmail via gog)

- **Important/sensitive emails:** Always draft and show the user before sending. 
  Wait for explicit "send it" or "looks good" confirmation.
- **Routine emails (RSVPs, brief thank-yous, quick replies):** Send directly, 
  then confirm what you sent.
- **Never send more than 10 emails in a single conversation** without checking 
  in with the user.
- Use `gog gmail send` for sending, `gog gmail search` for searching.

## Communication Style Per User

- **Yannick:** Prefers concise, direct communication. Economist — comfortable 
  with technical language. Don't over-explain.
- **[Wife's name]:** [Adjust based on preferences]

## Handling Failures

- If a tool fails, try a different approach before telling the user it failed.
- If you can't complete a task after 2–3 attempts, explain what went wrong 
  specifically and suggest what they can do manually.
- Never say "I can't help" without explaining WHY.

## Context Awareness

- Always check the calendar before suggesting times.
- When discussing "this weekend" or "tomorrow", use the actual dates.
- If someone mentions a person by first name, check contacts before asking 
  for their email.
```

### 1.3 Create `USER.md`

Family context that Jarvis needs to know. OpenClaw injects this every turn, so keep it concise.

```markdown
# USER.md

## Family

- **Yannick** — Senior Research Economist, works partly from home. 
  Lives in London (N11). Prefers concise communication.
- **[Wife]** — [role/preferences]
- **Finn** — [age, school, relevant details]
- **Ella** — [age, school, relevant details]

## Key Contacts

[Add as needed — or move to a skill-based lookup if the list grows]

## Routines

- School run: [times]
- Regular family commitments: [day/time]

## Preferences

- Family calendar: Google Calendar (via gog)
- Email: Gmail (via gog)
- Location: London, UK
- Timezone: Europe/London
```

### 1.4 Create `TOOLS.md`

Additional guidance for tool usage beyond what's in AGENTS.md:

```markdown
# TOOLS.md

## Google Workspace (gog)

Jarvis uses the `gog` skill for Gmail, Calendar, Contacts, and Drive.
- Gmail: `gog gmail search`, `gog gmail send`, `gog gmail read`
- Calendar: `gog calendar list`, `gog calendar add`
- Contacts: `gog contacts search`
- Drive: `gog drive search`, `gog drive read`

When sending emails, always draft important ones first and confirm with the user.

## Web Search

Use web search proactively when the user asks about anything time-sensitive: 
weather, news, events, restaurant availability, school closures.

## File System

Jarvis can read and write files in the workspace. Use this for:
- Shopping lists (workspace/lists/shopping.md)
- Family notes (workspace/notes/)
- Temporary research output
```

### 1.5 Create `IDENTITY.md`

```markdown
# IDENTITY.md

name: Jarvis
theme: warm, practical household assistant
```

### 1.6 Create `HEARTBEAT.md`

The heartbeat runs on a schedule (configurable in openclaw.json). This is how Jarvis becomes proactive:

```markdown
# HEARTBEAT.md

## Morning Check-in (if run between 6:00–9:00)
1. Check today's calendar events
2. Check weather for London
3. Check for any unread important emails in the last 12 hours
4. Summarise briefly. Lead with time-sensitive items.
5. If nothing notable, reply HEARTBEAT_OK

## Midday Pulse (if run between 11:00–13:00)
1. Check for any new emails since morning
2. Check for upcoming events in the next 4 hours
3. Only report if something needs attention. Otherwise HEARTBEAT_OK

## Evening Wind-down (if run between 17:00–19:00)
1. Check tomorrow's calendar
2. Any pending reminders or tasks
3. If nothing, HEARTBEAT_OK
```

**Acceptance criteria:** Messaging Jarvis via Telegram produces responses with the right persona and tone. Jarvis knows family members by name.

---

## Phase 2: Core Configuration (`openclaw.json`)

**Goal:** Configure the model, channels, security, heartbeat, tools, and skills.

### 2.1 Model Configuration

```json
{
  "agent": {
    "model": {
      "primary": "anthropic/claude-sonnet-4-5",
      "fallbacks": [
        "anthropic/claude-opus-4-6"
      ]
    }
  }
}
```

Use Sonnet as default (fast, cost-effective for most household tasks). Opus as fallback for complex reasoning. If you have Anthropic Pro/Max OAuth, configure auth profiles for that.

### 2.2 Identity

```json
{
  "identity": {
    "name": "Jarvis",
    "theme": "warm, practical household AI assistant",
    "emoji": "🏠"
  }
}
```

### 2.3 Channel Configuration

Start with Telegram. It's token-based (stateless), so it survives container restarts without re-pairing — ideal for Render.

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "allowFrom": []
    }
  }
}
```

**Security:** Use `dmPolicy: "pairing"` so unknown senders get a pairing code. After you and your wife message the bot for the first time, approve with `openclaw pairing approve telegram <code>`. Run `openclaw doctor` to verify.

### 2.4 Heartbeat

```json
{
  "heartbeat": {
    "every": "2h",
    "target": "last",
    "activeHours": {
      "start": "07:00",
      "end": "22:00",
      "timezone": "Europe/London"
    }
  }
}
```

### 2.5 Tools Configuration

Enable the tools Jarvis needs:

```json
{
  "tools": {
    "allow": [
      "read", "write", "exec",
      "web_search", "web_fetch", "browser"
    ]
  }
}
```

### 2.6 Skills Configuration

```json
{
  "skills": {
    "entries": {
      "gog": {
        "enabled": true,
        "env": {
          "GOG_KEYRING_PASSWORD": "$GOG_KEYRING_PASSWORD",
          "GOG_ACCOUNT": "$GOG_ACCOUNT"
        }
      },
      "household": { "enabled": true },
      "weather": { "enabled": true }
    },
    "allowBundled": ["gog", "web-search", "web-fetch"]
  }
}
```

**Note on `gog` setup:** The `gog` skill requires a one-time OAuth setup to authorise access to your Google account. This needs to be done locally (or via SSH into the Render instance) before the skill works:

```bash
gog auth credentials ~/Downloads/client_secret_*.json
gog auth add your-email@gmail.com --services gmail,calendar,drive,contacts --manual
```

The `--manual` flag gives you a URL to paste in a browser, then you copy the auth code back. The credentials are stored in a keyring protected by `GOG_KEYRING_PASSWORD`.

### 2.7 Session / Context Management

```json
{
  "sessions": {
    "context": {
      "softThresholdTokens": 40000,
      "flushToMemory": true
    },
    "ttl": {
      "idle": "4h",
      "max": "24h"
    }
  }
}
```

**Acceptance criteria:** Full `openclaw.json` is committed. `openclaw doctor` passes with no errors. Gateway restarts cleanly with the new config.

---

## Phase 3: Skills Setup

**Goal:** Configure the bundled `gog` skill for Google Workspace and build the household-specific skill.

### 3.1 Google Workspace via `gog` (Bundled Skill — Email + Calendar + Contacts + Drive)

The `gog` skill is bundled with OpenClaw — you don't need to write it. But you do need to do a one-time OAuth setup. This is the most involved setup step.

**Prerequisites:**
1. A Google Cloud project with the Gmail, Calendar, Drive, and Contacts APIs enabled
2. An OAuth 2.0 client ID (download the `client_secret_*.json` from Google Cloud Console)

**Setup steps (run on the Render instance via SSH, or locally if testing first):**

```bash
# Provide your OAuth credentials
gog auth credentials ~/Downloads/client_secret_*.json

# Add your Google account — choose a keyring password and REMEMBER IT
GOG_KEYRING_PASSWORD=<your-password> gog auth add your-email@gmail.com \
  --services gmail,calendar,drive,contacts --manual

# The --manual flag gives a URL. Open it in your browser, authorise, paste the code back.

# Test it works:
GOG_KEYRING_PASSWORD=<your-password> GOG_ACCOUNT=your-email@gmail.com gog gmail search "is:unread" --max 5
GOG_KEYRING_PASSWORD=<your-password> GOG_ACCOUNT=your-email@gmail.com gog calendar list
```

**What `gog` gives you (no custom code needed):**
- `gog gmail search` — search emails
- `gog gmail send` — send emails
- `gog gmail read` — read specific emails
- `gog calendar list` — view upcoming events
- `gog calendar add` — create events
- `gog contacts search` — look up contacts
- `gog drive search` / `gog drive read` — access Drive files

This single bundled skill replaces both a custom email skill AND a custom calendar skill. Jarvis gets email, calendar, contacts, and drive out of the box.

### 3.2 Household Skill (Custom)

`workspace/skills/household/SKILL.md`:

```markdown
---
name: household
description: "Manage household information: shopping lists, family notes, and preferences."
---

# Household Management Skill

## Shopping List
- Read: `cat {baseDir}/../../lists/shopping.md`
- Add item: `echo "- [ ] <item>" >> {baseDir}/../../lists/shopping.md`
- Clear completed: (script to remove checked items)

## Family Notes
- Read a note: `cat {baseDir}/../../notes/<topic>.md`
- Write a note: Write to `{baseDir}/../../notes/<topic>.md`
- List notes: `ls {baseDir}/../../notes/`

## Preferences
- Family preferences are in `{baseDir}/data/preferences.json`
- Dietary restrictions, school schedules, regular appointments
```

### 3.3 Weather Skill (or use bundled)

OpenClaw may have a bundled weather skill. If not, web search handles weather queries well enough to start.

**Acceptance criteria:** `gog gmail search "is:unread"` works. Household skill appears in `openclaw skills list`. Test via `openclaw agent --message "What's on my calendar today?"`.

---

## Phase 4: Render Deployment Polish

**Goal:** Production-ready deployment on Render with monitoring and persistence.

### 4.1 Start Script

Create `scripts/start.sh`:

```bash
#!/bin/bash
set -e

# Ensure persistent storage is linked
OPENCLAW_DATA="/var/data/openclaw"
mkdir -p "$OPENCLAW_DATA"

# Symlink if not already done
if [ ! -L "$HOME/.openclaw" ]; then
  rm -rf "$HOME/.openclaw"
  ln -sf "$OPENCLAW_DATA" "$HOME/.openclaw"
fi

# Copy workspace files from repo to persistent storage on first run
# (subsequent deploys: only update if workspace files changed)
WORKSPACE="$OPENCLAW_DATA/workspace"
if [ ! -f "$WORKSPACE/SOUL.md" ]; then
  echo "First run — initialising workspace..."
  cp -r ./workspace/* "$WORKSPACE/"
fi

# Always sync config (so deploys pick up config changes)
cp ./openclaw.json "$OPENCLAW_DATA/openclaw.json"

# Always sync skills (so deploys pick up skill changes)
cp -r ./workspace/skills/* "$WORKSPACE/skills/" 2>/dev/null || true

# Start gateway
exec npx openclaw gateway start --foreground --verbose
```

Update `render.yaml`:

```yaml
startCommand: bash scripts/start.sh
```

### 4.2 Repository Structure

```
jarvis-openclaw/
├── render.yaml
├── package.json
├── openclaw.json                    # Main config (committed, secrets via env vars)
├── scripts/
│   └── start.sh                     # Render start script
├── workspace/
│   ├── SOUL.md                      # Jarvis persona
│   ├── AGENTS.md                    # Behavioural rules
│   ├── USER.md                      # Family context
│   ├── TOOLS.md                     # Tool guidance
│   ├── IDENTITY.md                  # Name/theme
│   ├── HEARTBEAT.md                 # Proactive routines
│   ├── lists/
│   │   └── shopping.md
│   ├── notes/
│   │   └── .gitkeep
│   └── skills/
│       └── household/
│           ├── SKILL.md
│           └── data/
│               └── preferences.json
└── .gitignore
```

### 4.3 `.gitignore`

```
node_modules/
*.log
.env
# Don't commit secrets — they go in Render env vars
credentials/
```

### 4.4 Environment Variables (set in Render dashboard)

```
ANTHROPIC_API_KEY=sk-ant-...
GOG_KEYRING_PASSWORD=...
GOG_ACCOUNT=your-email@gmail.com
```

### 4.5 Monitoring

- Render provides built-in logs — check them after deploy
- Run `openclaw doctor` locally against the same config to validate
- Set up Render's health check or a simple cron that pings the gateway

**Acceptance criteria:** `git push` triggers a Render deploy. Jarvis comes online, connects to Telegram, and responds to messages. Sessions and memory persist across deploys.

---

## Phase 5: Testing & Iteration

**Goal:** Validate Jarvis works end-to-end for real household scenarios.

### 5.1 Test Matrix

| Test | What to verify |
|------|---------------|
| "What's the weather today?" | Web search or weather skill works |
| "What's on my calendar this week?" | `gog calendar list` works |
| "Email John about Saturday dinner" | `gog gmail send` (with draft confirmation) |
| "Add milk to the shopping list" | Household skill file operations |
| "What did the school send us?" | `gog gmail search` works |
| "Who's John's email?" | `gog contacts search` works |
| Send a message from an unknown Telegram account | Pairing code challenge (security) |
| Long multi-step request | Context management, multiple tool calls |
| Morning heartbeat fires | Proactive briefing arrives in Telegram on schedule |

### 5.2 Iteration Loop

1. Test a scenario via Telegram
2. If it fails or feels wrong, check:
   - Render logs for errors
   - `SOUL.md` / `AGENTS.md` for unclear instructions
   - Skill scripts for bugs
3. Fix, commit, push — Render redeploys automatically
4. Repeat

### 5.3 Prompt Tuning

The biggest lever is the workspace files. Iterate on these based on real usage:
- If Jarvis is too verbose → tighten SOUL.md
- If Jarvis doesn't use a tool when it should → add guidance to AGENTS.md
- If Jarvis gets confused about family members → expand USER.md
- If a skill doesn't trigger → check its description in SKILL.md

---

## Phase 6: Extensions (Future)

Once the core is solid, consider:

- **Multi-agent routing:** Separate agents for work vs. family, routed by channel or contact
- **WhatsApp:** Add as a second channel once Telegram is solid
- **Voice:** ElevenLabs TTS for voice responses on mobile
- **Canvas:** Live visual workspace for family dashboards
- **Cron jobs:** Automated weekly meal planning, expense summaries, school schedule reminders
- **Signal / iMessage:** Additional secure channels for the family
- **Google Drive integration:** Already available via gog — use for shared documents, school forms, etc.

---

## Build Order for Claude Code

When you give this plan to Claude Code, it should execute in this order:

```
Phase 0 → Get OpenClaw running on Render (skeleton deploy)
Phase 1 → Write all workspace files (SOUL.md, AGENTS.md, etc.)
Phase 2 → Write openclaw.json with full config
Phase 3 → Set up gog (Google OAuth), then build household skill
Phase 4 → Wire up start.sh, render.yaml, .gitignore
Phase 5 → Deploy, connect Telegram, test end-to-end
```

Each phase should be a separate commit. Test after each phase before moving on.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Render's ephemeral filesystem loses state | Persistent disk + symlink in start.sh |
| OpenClaw gateway port doesn't match Render's $PORT | Test early in Phase 0; may need config override |
| gog OAuth credentials expire or keyring is lost | Store keyring on persistent disk; re-auth if needed |
| Skills don't trigger reliably | Write clear, specific descriptions; test with `openclaw agent --message` |
| Context window fills up on long conversations | Configure `softThresholdTokens` for compaction + memory flush |
| Costs spiral with Opus on every turn | Sonnet as primary, Opus only as fallback |
| Google API rate limits on heavy Gmail use | gog handles this; monitor via Google Cloud Console |

---

## What This Gives You vs. Custom Python Agent

| Dimension | Custom Python | OpenClaw on Render |
|-----------|--------------|-------------------|
| Agentic loop | You wrote it | OpenClaw handles it |
| Channel integrations | You'd build each one | Telegram (+ WhatsApp, Signal, etc.) built in |
| Session management | You'd build it | Built in with compaction + memory flush |
| Daemon lifecycle | You'd manage it | Render Worker + OpenClaw gateway |
| System prompt | Full control (Python) | Full control (workspace .md files) |
| Tool design | Full control (Python) | Full control (skills + scripts) |
| Memory | You'd build it | Built in (MEMORY.md + daily flush) |
| Proactive actions | You'd build cron | Built in (heartbeat + cron jobs) |
| Multi-user routing | You'd build it | Built in (agent bindings) |
| Security | You'd build it | Built in (DM pairing, allowlists) |
| Cost to maintain | High | Low — OpenClaw community maintains infra |
