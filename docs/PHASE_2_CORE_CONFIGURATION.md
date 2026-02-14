# Phase 2: Core Configuration (`openclaw.json`)

**Goal:** Configure the model, channels, security, heartbeat, tools, and skills in `openclaw.json`.

**Depends on:** Phase 1 (workspace files exist).

**Deliverables:** A complete `openclaw.json` that passes `openclaw doctor` validation.

---

## Prerequisites

- [ ] Phase 0 and 1 complete
- [ ] Telegram Bot Token (create via @BotFather on Telegram)
- [ ] Anthropic API key set in environment

---

## Steps

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

**Design rationale:**
- **Sonnet 4.5** as primary: fast, cost-effective, handles 95% of household tasks well
- **Opus 4.6** as fallback: only activated when Sonnet fails (e.g., complex multi-step reasoning, rate limits)
- Cost control: Sonnet is significantly cheaper per token than Opus

**Open question:** Does OpenClaw support auth profiles for Anthropic Pro/Max OAuth? If so, this could reduce costs further. Check docs.

### 2.2 Identity Configuration

```json
{
  "identity": {
    "name": "Jarvis",
    "theme": "warm, practical household AI assistant",
    "emoji": "🏠"
  }
}
```

This sets the display name in Telegram and other channels.

### 2.3 Channel Configuration — Telegram

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

**Security model:**
- `dmPolicy: "pairing"` means unknown senders receive a pairing code challenge
- After you and your wife message the bot for the first time, approve via:
  ```bash
  openclaw pairing approve telegram <code>
  ```
- `allowFrom: []` starts empty — users are added via the pairing flow

**Setup steps for Telegram:**
1. Message @BotFather on Telegram to create a new bot
2. Get the bot token
3. Set the token as `TELEGRAM_BOT_TOKEN` in Render environment variables (or wherever OpenClaw expects it — check docs)
4. Configure the bot's name and description in BotFather to match Jarvis's identity

### 2.4 Heartbeat Configuration

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

**How this works:**
- Every 2 hours during active hours, OpenClaw triggers the heartbeat
- `target: "last"` sends the heartbeat to the most recently active conversation
- The heartbeat instructions in `HEARTBEAT.md` (Phase 1) determine what Jarvis checks and whether to message the user
- Outside `07:00-22:00 Europe/London`, no heartbeats fire

**Tuning notes:**
- If 2h is too frequent (too many messages), increase to `"every": "4h"`
- If morning briefing is too early, change `start` to `"08:00"`
- The `HEARTBEAT_OK` response in HEARTBEAT.md suppresses messages when nothing is notable

### 2.5 Tools Configuration

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

**Tool breakdown:**
| Tool | Purpose | Risk Level |
|------|---------|------------|
| `read` | Read files in workspace (shopping lists, notes) | Low |
| `write` | Write files in workspace | Low |
| `exec` | Execute shell commands (needed for skill scripts) | Medium — sandboxed to workspace |
| `web_search` | Search the web for weather, news, etc. | Low |
| `web_fetch` | Fetch content from URLs | Low |
| `browser` | Full browser automation | Medium — useful for complex web tasks |

**Security note:** `exec` is needed for the household skill's shell commands. OpenClaw sandboxes execution, but review what commands the skill can run.

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

**Notes:**
- `gog` is bundled — no custom code needed, but requires OAuth setup (Phase 3)
- `household` is custom — defined in `workspace/skills/household/SKILL.md`
- `weather` — check if OpenClaw bundles this; if not, web search covers it
- `$GOG_KEYRING_PASSWORD` and `$GOG_ACCOUNT` reference Render env vars

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

**What these settings do:**
- `softThresholdTokens: 40000` — when the conversation hits ~40k tokens, OpenClaw compacts older messages (summarises and archives)
- `flushToMemory: true` — compacted context is written to MEMORY.md so Jarvis retains long-term knowledge
- `idle: "4h"` — session expires after 4 hours of inactivity (new conversation starts fresh but with memory)
- `max: "24h"` — hard cap on session length

**Tuning guidance:**
- If Jarvis loses context too quickly, increase `softThresholdTokens`
- If memory gets too large/noisy, consider periodic manual cleanup of MEMORY.md

### 2.8 Assemble the complete `openclaw.json`

Combine all sections into one file:

```json
{
  "agent": {
    "model": {
      "primary": "anthropic/claude-sonnet-4-5",
      "fallbacks": ["anthropic/claude-opus-4-6"]
    }
  },
  "identity": {
    "name": "Jarvis",
    "theme": "warm, practical household AI assistant",
    "emoji": "🏠"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "allowFrom": []
    }
  },
  "heartbeat": {
    "every": "2h",
    "target": "last",
    "activeHours": {
      "start": "07:00",
      "end": "22:00",
      "timezone": "Europe/London"
    }
  },
  "tools": {
    "allow": ["read", "write", "exec", "web_search", "web_fetch", "browser"]
  },
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
  },
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

---

## Testing

```bash
# Validate config
npx openclaw doctor

# Check that all sections are recognised
npx openclaw gateway --verbose  # Look for config loading messages in logs

# Verify skills are registered
npx openclaw skills list
```

---

## Acceptance Criteria

- [ ] Complete `openclaw.json` is committed to the repo
- [ ] `npx openclaw doctor` passes with no errors
- [ ] Gateway restarts cleanly with the new config
- [ ] All configured skills appear in `npx openclaw skills list`
- [ ] Telegram bot token is set (either in config or env var)
- [ ] Heartbeat configuration is validated (check logs for heartbeat scheduling)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Config schema doesn't match OpenClaw version | Gateway fails to start | Check OpenClaw docs for exact schema; use `openclaw doctor` |
| Telegram token location unknown | Channel won't connect | Check docs — may be env var, config field, or onboarding step |
| Heartbeat too frequent | Annoying messages | Start with `"every": "2h"`, adjust based on real usage |
| Tool permissions too broad | Security concern | Review `exec` scope; restrict if needed |

---

## Commit

```bash
git add openclaw.json
git commit -m "Phase 2: Core openclaw.json configuration"
```
