# Phase 3: Skills Setup

**Goal:** Configure the bundled `gog` skill for Google Workspace and build the custom household skill.

**Depends on:** Phase 2 (openclaw.json with skills configuration).

**Deliverables:** Working `gog` integration (Gmail, Calendar, Contacts, Drive) and a custom household skill for shopping lists, notes, and family data.

---

## Prerequisites

- [ ] Phase 0-2 complete
- [ ] A Google Cloud project with these APIs enabled:
  - Gmail API
  - Google Calendar API
  - Google Drive API
  - People API (Contacts)
- [ ] An OAuth 2.0 client ID downloaded as `client_secret_*.json` from Google Cloud Console
- [ ] A chosen keyring password for `GOG_KEYRING_PASSWORD`
- [ ] Your Gmail address for `GOG_ACCOUNT`

---

## Steps

### 3.1 Google Cloud Project Setup

If you don't already have a Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Jarvis Assistant")
3. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - People API (for Contacts)
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
   - Application type: **Desktop app** (not Web — we're using manual auth flow)
   - Download the `client_secret_*.json` file
5. Configure the **OAuth consent screen**:
   - User type: External (or Internal if using Google Workspace)
   - Add your email as a test user
   - Scopes: add Gmail, Calendar, Drive, Contacts scopes

### 3.2 Google OAuth Setup via `gog`

The `gog` skill is bundled with OpenClaw — no custom code needed. But it requires a one-time OAuth setup.

**Run locally first** (easier to debug than on Render):

```bash
# Step 1: Provide your OAuth credentials
gog auth credentials ~/Downloads/client_secret_*.json

# Step 2: Add your Google account
GOG_KEYRING_PASSWORD=<your-password> gog auth add your-email@gmail.com \
  --services gmail,calendar,drive,contacts --manual

# The --manual flag outputs a URL.
# 1. Open it in your browser
# 2. Sign in and authorise the app
# 3. Copy the authorisation code
# 4. Paste it back into the terminal
```

**Important notes:**
- The `--manual` flag is required because we can't open a browser on a headless server
- The keyring password encrypts your OAuth tokens at rest
- Choose a strong keyring password and store it securely (it goes in Render env vars)

### 3.3 Test `gog` locally

```bash
# Test Gmail
GOG_KEYRING_PASSWORD=<pw> GOG_ACCOUNT=your-email@gmail.com gog gmail search "is:unread" --max 5

# Test Calendar
GOG_KEYRING_PASSWORD=<pw> GOG_ACCOUNT=your-email@gmail.com gog calendar list

# Test Contacts
GOG_KEYRING_PASSWORD=<pw> GOG_ACCOUNT=your-email@gmail.com gog contacts search "John"

# Test Drive
GOG_KEYRING_PASSWORD=<pw> GOG_ACCOUNT=your-email@gmail.com gog drive search "school"
```

**Expected output:** Each command returns real data from your Google account. If any fail, check:
- API is enabled in Google Cloud Console
- OAuth scopes include the relevant service
- Keyring password matches what was used during `gog auth add`

### 3.4 Transfer `gog` credentials to Render

The OAuth tokens are stored in a keyring on disk. You need to get them onto Render's persistent disk.

**Option A — Re-auth on Render:**
```bash
# SSH into the Render instance
render ssh jarvis-gateway

# Re-run the auth flow
gog auth credentials /path/to/client_secret.json
GOG_KEYRING_PASSWORD=<pw> gog auth add your-email@gmail.com \
  --services gmail,calendar,drive,contacts --manual
```

**Option B — Copy keyring from local:**
```bash
# Find where gog stores the keyring locally
ls ~/.gog/  # or wherever it stores credentials

# Copy to Render's persistent disk
scp ~/.gog/keyring /var/data/openclaw/gog/keyring
```

Check OpenClaw/gog docs for the exact credential storage location.

### 3.5 Set Render environment variables

In the Render dashboard, set:
- `GOG_KEYRING_PASSWORD` = your chosen keyring password
- `GOG_ACCOUNT` = your Gmail address

### 3.6 Build the Household Skill (Custom)

Create `workspace/skills/household/SKILL.md`:

```markdown
---
name: household
description: "Manage household information: shopping lists, family notes, and preferences."
---

# Household Management Skill

## Shopping List

### View the shopping list
`cat {baseDir}/../../lists/shopping.md`

### Add an item to the shopping list
`echo "- [ ] <item>" >> {baseDir}/../../lists/shopping.md`

### Mark an item as done
Replace `- [ ] <item>` with `- [x] <item>` in the shopping list file.

### Clear completed items
`sed -i '/- \[x\]/d' {baseDir}/../../lists/shopping.md`

## Family Notes

### Read a note
`cat {baseDir}/../../notes/<topic>.md`

### Write or update a note
Write content to `{baseDir}/../../notes/<topic>.md`

### List all notes
`ls {baseDir}/../../notes/`

## Preferences

Family preferences are stored in `{baseDir}/data/preferences.json`.
This includes dietary restrictions, school schedules, and regular appointments.
```

**File structure for the household skill:**
```
workspace/skills/household/
├── SKILL.md              # Skill definition
└── data/
    └── preferences.json  # Family preferences
```

### 3.7 Create initial household data files

`workspace/lists/shopping.md`:
```markdown
# Shopping List

- [ ] Example item (delete me)
```

`workspace/skills/household/data/preferences.json`:
```json
{
  "dietary": {
    "notes": []
  },
  "schools": {},
  "regularAppointments": []
}
```

### 3.8 Weather Skill

Check if OpenClaw bundles a weather skill:
```bash
npx openclaw skills list | grep -i weather
```

If bundled, enable it in `openclaw.json` (already done in Phase 2). If not, web search handles weather queries well enough — no custom skill needed for now.

---

## Testing

### Integration tests via OpenClaw agent

```bash
# Test gog Gmail
npx openclaw agent --message "Show me my unread emails"
# Expected: Jarvis searches Gmail and lists unread emails

# Test gog Calendar
npx openclaw agent --message "What's on my calendar today?"
# Expected: Jarvis lists today's calendar events

# Test gog Contacts
npx openclaw agent --message "What's John's email address?"
# Expected: Jarvis searches contacts and returns the email

# Test household shopping list
npx openclaw agent --message "Add milk to the shopping list"
# Expected: Jarvis appends "- [ ] milk" to shopping.md

npx openclaw agent --message "What's on the shopping list?"
# Expected: Jarvis reads and returns the list

# Test household notes
npx openclaw agent --message "Make a note about Finn's school play on March 15th"
# Expected: Jarvis creates workspace/notes/finn-school-play.md (or similar)
```

### Verify skill registration

```bash
npx openclaw skills list
# Expected: gog, household listed and enabled
```

---

## Acceptance Criteria

- [ ] `gog gmail search "is:unread"` works with correct credentials
- [ ] `gog calendar list` returns real calendar data
- [ ] `gog contacts search` returns real contacts
- [ ] Household skill appears in `npx openclaw skills list`
- [ ] Shopping list operations (add, view, mark done) work
- [ ] Notes operations (create, read, list) work
- [ ] `npx openclaw agent --message "What's on my calendar today?"` returns real data
- [ ] Credentials persist across Render redeploys (on persistent disk)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google OAuth token expires | gog stops working | Tokens auto-refresh; if refresh token expires, re-auth |
| Keyring file lost on Render redeploy | OAuth tokens gone | Keyring must be on persistent disk, not ephemeral storage |
| Google API rate limits | Commands fail under heavy use | gog handles rate limiting; monitor in Google Cloud Console |
| Household skill path references break | File operations fail | Test `{baseDir}` resolution; use absolute paths as fallback |
| OAuth consent screen not configured | Auth flow fails | Add yourself as test user; request verification if needed |

---

## Commit

```bash
git add workspace/skills/ workspace/lists/ workspace/notes/
git commit -m "Phase 3: gog skill setup and custom household skill"
```
