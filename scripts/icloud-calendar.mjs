#!/usr/bin/env node
// iCloud Calendar CLI — queries and creates events via CalDAV using tsdav.
// Usage: node icloud-calendar.mjs <command> [args...]
// Env: ICLOUD_EMAIL, ICLOUD_APP_PASSWORD

import { DAVClient } from 'tsdav';

const EMAIL = process.env.ICLOUD_EMAIL;
const PASSWORD = process.env.ICLOUD_APP_PASSWORD;
const TZ = 'Europe/London';

if (!EMAIL || !PASSWORD) {
  console.error(JSON.stringify({ error: 'ICLOUD_EMAIL and ICLOUD_APP_PASSWORD must be set' }));
  process.exit(1);
}

// ── ICS parser ──────────────────────────────────────────────────────────────

function parseICSDate(value, fullLine) {
  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, allDay: true };
  }
  // UTC: YYYYMMDDTHHMMSSZ
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8);
    const H = value.slice(9, 11), M = value.slice(11, 13), S = value.slice(13, 15);
    return { iso: `${y}-${m}-${d}T${H}:${M}:${S}Z`, allDay: false };
  }
  // Local or TZID: YYYYMMDDTHHMMSS
  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8);
    const H = value.slice(9, 11), M = value.slice(11, 13), S = value.slice(13, 15);
    const tzMatch = fullLine.match(/TZID=([^:;]+)/);
    const tz = tzMatch ? tzMatch[1] : TZ;
    // Build a date in the given timezone and convert to ISO UTC
    const dt = new Date(new Date(`${y}-${m}-${d}T${H}:${M}:${S}`).toLocaleString('en-US', { timeZone: tz }));
    // Safer approach: just return the local representation with tz info
    return { iso: `${y}-${m}-${d}T${H}:${M}:${S}`, tz, allDay: false };
  }
  return { iso: value, allDay: false };
}

function parseVEvents(icsData) {
  if (!icsData) return [];
  const events = [];
  const blocks = icsData.split('BEGIN:VEVENT');
  for (const block of blocks.slice(1)) {
    const end = block.indexOf('END:VEVENT');
    if (end === -1) continue;
    const content = block.substring(0, end);
    // Unfold lines (RFC 5545: continuation lines start with space/tab)
    const unfolded = content.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const event = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/);
      if (!match) continue;
      const [, key, val] = match;
      switch (key) {
        case 'SUMMARY': event.summary = val; break;
        case 'DTSTART': event.start = parseICSDate(val, line); break;
        case 'DTEND': event.end = parseICSDate(val, line); break;
        case 'LOCATION': event.location = val; break;
        case 'DESCRIPTION': event.description = val?.replace(/\\n/g, '\n').replace(/\\,/g, ','); break;
        case 'UID': event.uid = val; break;
      }
    }
    if (event.summary) events.push(event);
  }
  return events;
}

function formatLondon(parsed) {
  if (!parsed) return null;
  if (parsed.allDay) return parsed.iso + ' (all day)';
  try {
    const d = new Date(parsed.iso + (parsed.iso.endsWith('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return parsed.iso;
    return d.toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZone: TZ,
    });
  } catch {
    return parsed.iso;
  }
}

// ── CalDAV client ───────────────────────────────────────────────────────────

async function getClient() {
  const client = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: EMAIL, password: PASSWORD },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  await client.login();
  return client;
}

// ── Subcommands ─────────────────────────────────────────────────────────────

async function listCalendars() {
  const client = await getClient();
  const calendars = await client.fetchCalendars();
  const result = calendars.map(c => ({
    name: c.displayName || 'Unnamed',
    url: c.url,
  }));
  console.log(JSON.stringify(result, null, 2));
}

async function getEventsInRange(startISO, endISO) {
  const client = await getClient();
  const calendars = await client.fetchCalendars();
  const allEvents = [];

  for (const cal of calendars) {
    try {
      const objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange: { start: startISO, end: endISO },
      });
      for (const obj of objects) {
        const events = parseVEvents(obj.data);
        for (const e of events) {
          allEvents.push({
            summary: e.summary,
            start: e.start?.iso,
            startFormatted: formatLondon(e.start),
            end: e.end?.iso,
            endFormatted: formatLondon(e.end),
            allDay: e.start?.allDay || false,
            location: e.location || null,
            description: e.description || null,
            calendar: cal.displayName || 'Unnamed',
            uid: e.uid,
          });
        }
      }
    } catch (err) {
      // Skip calendars that error (e.g. subscribed calendars without REPORT support)
      console.error(`Warning: skipped calendar "${cal.displayName}": ${err.message}`);
    }
  }

  allEvents.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.start || '').localeCompare(b.start || '');
  });
  console.log(JSON.stringify(allEvents, null, 2));
}

function dayRange(offsetDays, spanDays = 1) {
  const now = new Date();
  const base = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + offsetDays);
  const start = base.toISOString();
  const end = new Date(base.getTime() + spanDays * 86400000).toISOString();
  return { start, end };
}

async function getToday() {
  const { start, end } = dayRange(0);
  await getEventsInRange(start, end);
}

async function getTomorrow() {
  const { start, end } = dayRange(1);
  await getEventsInRange(start, end);
}

async function getWeek() {
  const { start, end } = dayRange(0, 7);
  await getEventsInRange(start, end);
}

async function addEvent(calendarName, summary, startISO, endISO, location, description) {
  if (!calendarName || !summary || !startISO || !endISO) {
    console.error(JSON.stringify({ error: 'Usage: add <calendar> <summary> <start> <end> [location] [description]' }));
    process.exit(1);
  }

  const client = await getClient();
  const calendars = await client.fetchCalendars();
  const cal = calendars.find(c =>
    (c.displayName || '').toLowerCase() === calendarName.toLowerCase()
  );
  if (!cal) {
    const names = calendars.map(c => c.displayName).filter(Boolean);
    console.error(JSON.stringify({ error: `Calendar "${calendarName}" not found. Available: ${names.join(', ')}` }));
    process.exit(1);
  }

  const uid = `jarvis-${Date.now()}@icloud-calendar`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dtstart = startISO.replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dtend = endISO.replace(/[-:]/g, '').replace(/\.\d+/, '');

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jarvis//icloud-calendar//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
  ];
  if (location) ics.push(`LOCATION:${location}`);
  if (description) ics.push(`DESCRIPTION:${description.replace(/\n/g, '\\n')}`);
  ics.push('END:VEVENT', 'END:VCALENDAR');

  const result = await client.createCalendarObject({
    calendar: cal,
    filename: `${uid}.ics`,
    iCalString: ics.join('\r\n'),
  });

  if (result.ok) {
    console.log(JSON.stringify({ success: true, uid, summary, start: startISO, end: endISO, calendar: cal.displayName }));
  } else {
    console.error(JSON.stringify({ error: `Failed to create event: ${result.status} ${result.statusText}` }));
    process.exit(1);
  }
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'list-calendars': await listCalendars(); break;
    case 'today': await getToday(); break;
    case 'tomorrow': await getTomorrow(); break;
    case 'week': await getWeek(); break;
    case 'range':
      if (args.length < 2) {
        console.error(JSON.stringify({ error: 'Usage: range <startDate> <endDate> (ISO 8601)' }));
        process.exit(1);
      }
      await getEventsInRange(new Date(args[0]).toISOString(), new Date(args[1] + 'T23:59:59').toISOString());
      break;
    case 'add': await addEvent(...args); break;
    default:
      console.error(JSON.stringify({
        error: `Unknown command: ${cmd}`,
        usage: 'Commands: list-calendars, today, tomorrow, week, range <start> <end>, add <calendar> <summary> <start> <end> [location] [description]',
      }));
      process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
