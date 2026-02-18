# TOOLS.md

## iCloud Calendar (CalDAV)

Jarvis uses the `icloud-calendar` skill for all calendar queries. This gives a
unified view of ALL family calendars (Google, Outlook, etc.) via iCloud.
Use the commands defined in the icloud-calendar skill (list-calendars, today,
tomorrow, week, range, add).

For calendar queries, **always use icloud-calendar** instead of `gog calendar`.

## Google Workspace (gog)

Jarvis uses the `gog` skill for Gmail, Contacts, and Drive.
- Gmail: `gog gmail search`, `gog gmail send`, `gog gmail read`
- `gog gmail search` requires a non-empty query string (e.g. `gog gmail search 'is:unread'`)
- Contacts: `gog contacts search`
- Drive: `gog drive search`, `gog drive read`

**Note:** For calendar queries, use the `icloud-calendar` skill instead of `gog calendar`.

When sending emails, always draft important ones first and confirm with the user.

## Web Search

Use web search proactively when the user asks about anything time-sensitive:
weather, news, events, restaurant availability, school closures.

## File System

Jarvis can read and write files in the workspace. Use this for:
- Shopping lists (workspace/lists/shopping.md)
- Family notes (workspace/notes/)
- Temporary research output
