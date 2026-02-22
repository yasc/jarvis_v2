# CLAUDE.md — Jarvis on NanoClaw

## Project Overview

This project is **Jarvis**, a household AI assistant built on **NanoClaw** (previously OpenClaw, now replaced). The owner is Yannick, a Senior Research Economist living in London (N11) with his wife Jorien and two children (Finn, 6, and Ella, 2).

## What This Project Is

A personal household AI assistant accessible via messaging (channel TBD — was Telegram, NanoClaw uses WhatsApp by default). It can:
- Send, search, and reply to emails (via Gmail)
- Check and manage the family Google Calendar
- Look up Google Contacts
- Search the web
- Manage shopping lists and family notes
- Give proactive morning briefings
- Remember context across conversations

## Architecture

Single Node.js process that connects to a messaging channel, routes messages to Claude Agent SDK running in containers (Linux VMs). Each group has isolated filesystem and memory.

## Tech Stack

- **Runtime:** NanoClaw (Node.js, TypeScript)
- **Model:** Anthropic Claude (via Agent SDK)
- **Hosting:** TBD (was Render)
- **Channel:** TBD (NanoClaw default is WhatsApp)

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection, auth, send/receive |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |

## Development

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management (macOS):
```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run `./container/build.sh`.

## Git Commit Rules

- **Never** add a `Co-Authored-By` line to commit messages
- Keep commit messages short and terse (one line preferred)
- Don't mention secrets, tokens, or keys in commit messages
