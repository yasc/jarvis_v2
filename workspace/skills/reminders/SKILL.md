---
name: reminders
description: "Set, list, cancel, and snooze timed reminders."
---

# Reminders Skill

Reminders are stored in `{baseDir}/../../data/reminders.json`.

## Data Format

```json
{
  "reminders": [
    {
      "id": "r_1708012800000",
      "text": "Call the school",
      "due": "2026-02-16T15:00:00Z",
      "created": "2026-02-16T10:30:00Z",
      "createdBy": "Yannick",
      "status": "pending"
    }
  ]
}
```

- `due` is always stored in **UTC**. Convert from Europe/London when writing.
- `status`: `pending` | `fired` | `cancelled`
- `id`: `r_` + epoch milliseconds at creation time

## Set a Reminder

1. Read `{baseDir}/../../data/reminders.json`
2. Parse the user's time expression:
   - "at 3pm" → today 15:00 Europe/London; if already passed, use tomorrow
   - "in 30 minutes" → now + 30 min
   - "tomorrow morning" → tomorrow 08:00 Europe/London
   - "tomorrow at 9" → tomorrow 09:00 Europe/London
3. Convert the time to UTC for the `due` field
4. Create a new entry with `id` = `r_` + `Date.now()`, `status` = `pending`
5. Append to the array and write the file back
6. Confirm to the user with the reminder text and the due time in Europe/London format

Do NOT ask for confirmation unless the time is genuinely ambiguous (e.g. "3" without am/pm context). Just set it.

## List Reminders

1. Read the file
2. Filter to `status === "pending"`
3. Display each with text and due time converted to Europe/London
4. If none pending, say so

## Cancel a Reminder

1. Read the file
2. Find the reminder matching the user's description (by text, fuzzy match is fine)
3. Set `status` to `cancelled`
4. Write the file back
5. Confirm cancellation

## Snooze a Reminder

1. Find the reminder (it may be `fired` or `pending`)
2. Update `due` to the new time (in UTC)
3. Set `status` back to `pending`
4. Write the file back
5. Confirm with new time in Europe/London

## Housekeeping

When there are more than 50 entries with status `fired` or `cancelled`, remove the oldest ones to keep the file small. Do this during evening heartbeat checks.
