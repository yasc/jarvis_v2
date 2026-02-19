#!/usr/bin/env node

/**
 * Morning briefing scheduler for Jarvis.
 * Fires at exactly 07:00 Europe/London every day via the gateway /hooks/agent endpoint.
 */

import { readFile } from 'node:fs/promises';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/var/data/openclaw';
const TOKEN_PATH = `${OPENCLAW_HOME}/.openclaw/gateway-token`;
const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}/hooks/agent`;
const TIMEZONE = 'Europe/London';
const BRIEFING_HOUR = 7;
const BRIEFING_MINUTE = 0;
const STARTUP_DELAY_MS = 30_000;

const BRIEFING_PROMPT = `MORNING BRIEFING — deliver this via Telegram to Yannick.

It's 7:00 AM. Run the morning briefing:
1. Check today's calendar events (use gog calendar list)
2. Check the weather for London (use web search)
3. Check for unread important emails in the last 12 hours (use gog gmail search 'is:unread newer_than:12h')
4. Check pending reminders due today (read workspace/data/reminders.json)
5. Summarise briefly. Lead with time-sensitive items.
6. Keep it concise and warm — this is the first message of the day.

If there's genuinely nothing notable, still send a brief good morning with the weather.`;

function log(msg) {
  console.log(`[briefing] ${new Date().toISOString()} ${msg}`);
}

async function getToken() {
  try {
    return (await readFile(TOKEN_PATH, 'utf-8')).trim();
  } catch {
    return process.env.OPENCLAW_GATEWAY_TOKEN || '';
  }
}

function msUntilNext(hour, minute, tz) {
  const now = new Date();
  // Get current time in the target timezone
  const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const target = new Date(nowInTz);
  target.setHours(hour, minute, 0, 0);

  // If target time already passed today, schedule for tomorrow
  if (target <= nowInTz) {
    target.setDate(target.getDate() + 1);
  }

  // Calculate the offset between real time and tz time to convert back
  const offsetMs = now.getTime() - nowInTz.getTime();
  const targetReal = new Date(target.getTime() + offsetMs);

  return targetReal.getTime() - now.getTime();
}

async function sendBriefing(token) {
  log('Sending morning briefing...');

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: BRIEFING_PROMPT,
      deliver: true,
      sessionKey: 'hook:morning-briefing',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gateway responded ${res.status}: ${body}`);
  }

  log('Morning briefing sent OK');
}

async function main() {
  log(`Starting (delay ${STARTUP_DELAY_MS / 1000}s for gateway init)...`);
  await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));
  log(`Running. Briefing scheduled daily at ${BRIEFING_HOUR}:${String(BRIEFING_MINUTE).padStart(2, '0')} ${TIMEZONE}`);
  log(`Gateway: ${GATEWAY_URL}`);

  while (true) {
    const waitMs = msUntilNext(BRIEFING_HOUR, BRIEFING_MINUTE, TIMEZONE);
    const waitHours = (waitMs / 3_600_000).toFixed(1);
    log(`Next briefing in ${waitHours}h`);

    await new Promise((r) => setTimeout(r, waitMs));

    const token = await getToken();
    if (!token) {
      log('No gateway token found, skipping briefing');
      // Wait a minute before recalculating to avoid tight loop
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }

    try {
      await sendBriefing(token);
    } catch (err) {
      log(`Failed to send briefing: ${err.message}`);
    }

    // Wait 2 minutes to avoid double-firing if timing is tight
    await new Promise((r) => setTimeout(r, 120_000));
  }
}

main();
