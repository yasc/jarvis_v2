# Phase 6: Extensions (Future)

**Goal:** Extend Jarvis's capabilities beyond the core household assistant once the foundation is solid.

**Depends on:** Phase 5 (core system tested and stable).

**Deliverables:** This phase is a roadmap — each extension is an independent mini-project. Prioritise based on real usage patterns from Phase 5.

---

## Prerequisites

- [ ] Phase 0-5 complete — Jarvis is stable and used daily
- [ ] At least 2 weeks of real usage to identify which extensions would be most valuable
- [ ] No critical bugs or reliability issues remaining

---

## Extension Options

### 6.1 Multi-Agent Routing

**What:** Separate agents for different contexts (e.g., work vs. family), routed by channel or contact.

**Why:** As Jarvis handles more domains, a single agent with all context becomes unwieldy. Separate agents can have focused system prompts and tool access.

**Implementation approach:**
- Create separate workspace configs for each agent
- Use OpenClaw's agent binding feature to route based on:
  - Channel (e.g., Telegram group = family, DM = personal)
  - User identity (Yannick gets work+family, wife gets family only)
- Share memory across agents where appropriate

**Effort:** Medium
**Value:** High if Jarvis is used for work tasks too

---

### 6.2 WhatsApp Channel

**What:** Add WhatsApp as a second messaging channel alongside Telegram.

**Why:** WhatsApp may be more natural for family members who don't use Telegram regularly.

**Implementation approach:**
- OpenClaw supports WhatsApp as a channel
- Add WhatsApp configuration to `openclaw.json`:
  ```json
  {
    "channels": {
      "whatsapp": {
        "enabled": true,
        "dmPolicy": "pairing"
      }
    }
  }
  ```
- Requires WhatsApp Business API access (Meta Business Suite)
- Set up phone number and verify business

**Effort:** Medium (mostly Meta's setup process)
**Value:** High if family prefers WhatsApp

---

### 6.3 Voice Responses

**What:** Text-to-speech for Jarvis responses, delivered as voice messages on Telegram/WhatsApp.

**Why:** Hands-free interaction while cooking, driving, etc.

**Implementation approach:**
- Integrate ElevenLabs TTS API
- Create a custom skill that:
  1. Takes Jarvis's text response
  2. Sends it to ElevenLabs for speech synthesis
  3. Returns the audio file as a voice message
- Choose a voice that matches Jarvis's personality (warm, British, clear)
- Consider voice input too (speech-to-text via Whisper or similar)

**Effort:** Medium
**Value:** Medium-High for hands-free scenarios
**Cost:** ElevenLabs has per-character pricing — monitor usage

---

### 6.4 Canvas / Visual Dashboard

**What:** A live visual workspace for family dashboards — calendar overview, shopping list, weather, upcoming events.

**Why:** A glanceable overview is sometimes more useful than asking Jarvis one question at a time.

**Implementation approach:**
- OpenClaw may support a Canvas feature for visual output
- Alternatively, build a simple web dashboard:
  - Read from the same data sources (calendar, shopping list, notes)
  - Host on Render as a Web Service (alongside the Worker)
  - Auto-refresh on a schedule

**Effort:** High
**Value:** Medium — depends on whether the family would actually look at a dashboard

---

### 6.5 Automated Cron Jobs

**What:** Scheduled tasks beyond the heartbeat — weekly meal planning, expense summaries, school schedule reminders.

**Why:** Some tasks are purely routine and don't need user initiation.

**Implementation approach:**
- Use OpenClaw's cron job feature (if available) or extend the heartbeat:
  ```json
  {
    "cron": {
      "weekly-meal-plan": {
        "schedule": "0 18 * * 0",
        "message": "Create a meal plan for the week based on what's in the fridge and family preferences"
      },
      "school-week-prep": {
        "schedule": "0 20 * * 0",
        "message": "Check the school calendar for this week and flag anything that needs preparation"
      }
    }
  }
  ```
- Each cron job triggers a Jarvis conversation that runs autonomously

**Effort:** Low-Medium
**Value:** High for reducing mental load

**Example cron jobs to consider:**
| Job | Schedule | Action |
|-----|----------|--------|
| Weekly meal plan | Sunday 6pm | Suggest meals based on preferences and calendar |
| School week prep | Sunday 8pm | Check school calendar, flag uniform/PE/trip days |
| Grocery order reminder | Saturday 9am | Review shopping list, suggest order |
| Weekly expense summary | Friday 5pm | Summarise the week's spending (if integrated) |
| Birthday reminder | Daily 8am | Check contacts for upcoming birthdays |

---

### 6.6 Additional Channels — Signal / iMessage

**What:** Add Signal or iMessage as secure messaging channels.

**Why:** Some family/friends may prefer Signal for privacy. iMessage is native to Apple devices.

**Implementation approach:**
- Signal: Check if OpenClaw supports Signal as a channel. May require Signal Bot API.
- iMessage: More complex — requires a Mac running as a bridge (e.g., via BlueBubbles or similar)

**Effort:** Signal = Medium, iMessage = High
**Value:** Low unless specific contacts prefer these channels

---

### 6.7 Google Drive Deep Integration

**What:** Proactive monitoring and management of shared Google Drive files.

**Why:** School forms, shared documents, and family files live in Drive.

**Implementation approach:**
- Already available via `gog drive search` and `gog drive read`
- Extend with:
  - Monitoring a shared folder for new files
  - Summarising new documents automatically
  - Filling in forms (if structured)

**Effort:** Low (mostly prompt engineering in AGENTS.md)
**Value:** Medium

---

### 6.8 Home Automation Integration

**What:** Control smart home devices via Jarvis.

**Why:** "Jarvis, turn off the lights" is the dream.

**Implementation approach:**
- Integrate with Home Assistant, Google Home, or Apple HomeKit via their APIs
- Create a custom `smart-home` skill
- Start with read-only (status queries) before enabling control actions

**Effort:** High
**Value:** High but requires smart home infrastructure
**Risk:** Security implications of giving an AI control of physical devices

---

## Prioritisation Framework

After Phase 5, rank extensions by:

1. **User demand** — what do Yannick and wife actually ask for?
2. **Effort vs. value** — quick wins first
3. **Foundation readiness** — does the current setup support it?

**Suggested priority order based on likely value:**

| Priority | Extension | Why |
|----------|-----------|-----|
| 1 | Automated Cron Jobs (6.5) | Low effort, high value, reduces mental load |
| 2 | WhatsApp Channel (6.2) | Medium effort, high value if family prefers it |
| 3 | Google Drive Deep Integration (6.7) | Low effort, builds on existing gog skill |
| 4 | Voice Responses (6.3) | Medium effort, great UX improvement |
| 5 | Multi-Agent Routing (6.1) | Medium effort, needed as complexity grows |
| 6 | Canvas Dashboard (6.4) | High effort, uncertain value |
| 7 | Home Automation (6.8) | High effort, requires infrastructure |
| 8 | Signal/iMessage (6.6) | Effort depends on channel, low demand |

---

## How to Implement Each Extension

For each extension you decide to build:

1. Create a new branch: `feature/<extension-name>`
2. Write a mini implementation plan (scope, files to create/modify, test plan)
3. Implement and test locally
4. Deploy to Render and test via Telegram
5. Merge to main once stable

Each extension should be independently deployable — don't bundle unrelated changes.
