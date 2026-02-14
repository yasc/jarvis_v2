# Phase 5: Testing & Iteration

**Goal:** Validate Jarvis works end-to-end for real household scenarios and iterate based on real usage.

**Depends on:** Phase 4 (Jarvis deployed and reachable via Telegram).

**Deliverables:** A fully tested, production-quality assistant with tuned persona and reliable skills.

---

## Prerequisites

- [ ] Phase 0-4 complete — Jarvis deployed on Render, connected to Telegram
- [ ] Telegram pairing completed for at least Yannick
- [ ] `gog` OAuth set up and working

---

## Steps

### 5.1 Systematic Test Matrix

Run each test via Telegram. Document pass/fail and any issues.

#### Core Functionality Tests

| # | Test Message | Expected Behaviour | Pass/Fail | Notes |
|---|-------------|-------------------|-----------|-------|
| 1 | "What's the weather today?" | Web search returns London weather | | |
| 2 | "What's on my calendar this week?" | `gog calendar list` returns events | | |
| 3 | "What's on my calendar tomorrow?" | Correct date-aware calendar query | | |
| 4 | "Email John about Saturday dinner" | Drafts email, shows for confirmation, then sends | | |
| 5 | "Send a quick thank-you to Sarah for dinner" | Sends directly (routine), confirms after | | |
| 6 | "Add milk to the shopping list" | Appends to shopping.md | | |
| 7 | "What's on the shopping list?" | Reads shopping.md contents | | |
| 8 | "What did the school send us?" | `gog gmail search` for school emails | | |
| 9 | "Who's John's email?" | `gog contacts search` returns email | | |
| 10 | "What time is Finn's football?" | Checks calendar for Finn-related events | | |

#### Persona & Tone Tests

| # | Test Message | Expected Behaviour | Pass/Fail | Notes |
|---|-------------|-------------------|-----------|-------|
| 11 | "Tell me about yourself" | Responds as Jarvis, warm and concise, not robotic | | |
| 12 | "What's 2+2?" | Quick, no-fuss answer | | |
| 13 | Long, detailed request | Detailed, structured response | | |
| 14 | "Hi" | Brief, friendly greeting — not a wall of text | | |

#### Security Tests

| # | Test | Expected Behaviour | Pass/Fail | Notes |
|---|------|-------------------|-----------|-------|
| 15 | Message from unknown Telegram account | Pairing code challenge — no data exposed | | |
| 16 | Ask Jarvis to share family info externally | Refuses per SOUL.md guardrails | | |
| 17 | Ask Jarvis to make a purchase | Refuses per SOUL.md guardrails | | |

#### Multi-Step & Context Tests

| # | Test | Expected Behaviour | Pass/Fail | Notes |
|---|------|-------------------|-----------|-------|
| 18 | "Email John about Saturday dinner" (John not in contacts) | Asks for John's email instead of guessing | | |
| 19 | Multi-turn conversation: ask about calendar, then "move that meeting to 3pm" | Maintains context, acts on the right event | | |
| 20 | Ask about "tomorrow" and "this weekend" | Uses actual dates, not relative terms only | | |

#### Heartbeat Tests

| # | Test | Expected Behaviour | Pass/Fail | Notes |
|---|------|-------------------|-----------|-------|
| 21 | Wait for morning heartbeat (7:00-9:00) | Proactive briefing arrives in Telegram | | |
| 22 | Heartbeat with no notable events | No message sent (HEARTBEAT_OK) | | |
| 23 | Heartbeat with unread important email | Message highlights the email | | |

### 5.2 Issue Tracking

For each test failure, document:

1. **What happened** — exact Jarvis response
2. **What should have happened** — expected behaviour
3. **Root cause** — which file/config is responsible
4. **Fix** — what to change

Use this template:

```markdown
### Issue: [Brief description]
- **Test #:** [number]
- **Message sent:** "..."
- **Jarvis responded:** "..."
- **Expected:** "..."
- **Root cause:** [SOUL.md too verbose / AGENTS.md missing rule / skill script bug / etc.]
- **Fix:** [Change X in Y file]
- **Status:** [ ] Fixed [ ] Deployed [ ] Verified
```

### 5.3 Prompt Tuning Guide

The biggest lever for improving Jarvis is the workspace files. Here's a decision tree:

| Symptom | Fix In | What To Change |
|---------|--------|----------------|
| Jarvis is too verbose | SOUL.md | Add stronger conciseness instructions |
| Jarvis doesn't use a tool when it should | AGENTS.md | Add explicit "when X, use Y" rule |
| Jarvis uses the wrong tool | TOOLS.md | Clarify tool selection guidance |
| Jarvis gets confused about family members | USER.md | Add more detail or disambiguate names |
| A skill doesn't trigger | SKILL.md | Improve the skill description (the `description` field in frontmatter) |
| Jarvis drafts emails when it should just send | AGENTS.md | Adjust the routine vs. important email rules |
| Jarvis sends emails when it should draft | AGENTS.md | Tighten the "important email" definition |
| Heartbeat messages are too noisy | HEARTBEAT.md | Raise the threshold for what's "notable" |
| Jarvis forgets context too quickly | openclaw.json | Increase `softThresholdTokens` |
| Jarvis personality feels off | SOUL.md | Rewrite personality section |

### 5.4 Iteration Loop

```
1. Test a scenario via Telegram
2. If it fails or feels wrong:
   a. Check Render logs for errors
   b. Identify which workspace file is responsible
   c. Edit the file
   d. Commit and push (Render redeploys automatically)
   e. Retest
3. If it works, move to the next test
4. Repeat until all 23 tests pass
```

### 5.5 Onboard Wife

Once core tests pass:
1. Have your wife message the Telegram bot
2. Approve her pairing code
3. Ask her to try natural requests ("What's for dinner?", "When is Ella's dentist?")
4. Gather feedback on tone and usefulness
5. Update AGENTS.md with her communication preferences
6. Add her test scenarios to the matrix above

### 5.6 Performance Baseline

After all tests pass, record a baseline:

| Metric | Value | Date |
|--------|-------|------|
| Average response time | | |
| Heartbeat reliability (% on time) | | |
| Skill trigger accuracy (correct tool used) | | |
| Token usage per conversation (average) | | |
| Monthly API cost estimate | | |

Monitor these over the first week and adjust configuration as needed.

---

## Acceptance Criteria

- [ ] All 23 tests in the matrix pass
- [ ] No critical issues remain open
- [ ] Wife successfully paired and can interact
- [ ] Heartbeat fires on schedule during active hours
- [ ] No crash loops or error patterns in Render logs
- [ ] Jarvis persona feels natural and concise (subjective but important)
- [ ] Performance baseline recorded

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt tuning takes many iterations | Slow progress | Focus on highest-impact issues first; batch changes |
| Heartbeat difficult to test (time-dependent) | Hard to verify | Temporarily change heartbeat to `"every": "5m"` for testing |
| Real data in tests (actual emails, calendar) | Privacy concern | This is your own data — just be aware when screenshotting |
| Wife finds Jarvis unhelpful | Low adoption | Prioritise her use cases; ask what she'd actually use it for |

---

## Commits

Multiple commits during this phase as you fix issues:

```bash
git commit -m "Phase 5: Fix verbose responses in SOUL.md"
git commit -m "Phase 5: Add email draft rule for school-related emails"
git commit -m "Phase 5: Tune heartbeat thresholds"
# etc.
```
