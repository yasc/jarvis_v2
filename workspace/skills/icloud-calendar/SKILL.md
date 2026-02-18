---
name: icloud-calendar
description: "Query and manage iCloud calendars — unified view of all family calendars (Google, Outlook, etc.)."
---

# iCloud Calendar Skill

Access all calendars synced to iCloud via CalDAV. This gives a unified view of
the entire family schedule across all calendar providers.

## List All Calendars

`node {baseDir}/icloud-calendar.mjs list-calendars`

## Today's Events

`node {baseDir}/icloud-calendar.mjs today`

## Tomorrow's Events

`node {baseDir}/icloud-calendar.mjs tomorrow`

## This Week's Events

`node {baseDir}/icloud-calendar.mjs week`

## Events in a Date Range

`node {baseDir}/icloud-calendar.mjs range <startDate> <endDate>`

Dates in YYYY-MM-DD format.

## Add an Event

`node {baseDir}/icloud-calendar.mjs add '<calendarName>' '<summary>' '<startISO>' '<endISO>' '<location>' '<description>'`

Start and end as ISO 8601 datetime strings (e.g. `2026-02-19T15:00:00Z`).

## Notes

- All output is JSON.
- Times are displayed in Europe/London timezone.
- For calendar queries, **prefer this skill** over `gog calendar` — it shows all calendars.
