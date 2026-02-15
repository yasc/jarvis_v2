#!/usr/bin/env node

/**
 * Background reminder checker for Jarvis.
 * Runs in a loop, checking every 60s for due reminders.
 * Fires them via the OpenClaw gateway /hooks/agent endpoint.
 */

import { readFile, writeFile } from 'node:fs/promises';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/var/data/openclaw';
const REMINDERS_PATH = `${OPENCLAW_HOME}/.openclaw/workspace/data/reminders.json`;
const TOKEN_PATH = `${OPENCLAW_HOME}/.openclaw/gateway-token`;
const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}/hooks/agent`;
const CHECK_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const STARTUP_DELAY_MS = 30_000;

function log(msg) {
  console.log(`[reminders] ${new Date().toISOString()} ${msg}`);
}

function formatDueTime(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

async function readReminders() {
  try {
    const raw = await readFile(REMINDERS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log(`Cannot read reminders: ${err.message}`);
    return null;
  }
}

async function writeReminders(data) {
  await writeFile(REMINDERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function getToken() {
  try {
    return (await readFile(TOKEN_PATH, 'utf-8')).trim();
  } catch {
    return process.env.OPENCLAW_GATEWAY_TOKEN || '';
  }
}

async function fireReminder(reminder, token) {
  const dueStr = formatDueTime(reminder.due);
  const message = [
    `REMINDER FIRING: "${reminder.text}"`,
    `Scheduled for: ${dueStr}`,
    `Set by: ${reminder.createdBy}`,
    `Deliver this reminder via Telegram. Be concise.`,
    `If it seems late or irrelevant, mention that and ask if still needed.`,
  ].join('\n');

  log(`Firing: "${reminder.text}" (due ${dueStr})`);

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      deliver: true,
      sessionKey: 'hook:reminders',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gateway responded ${res.status}: ${body}`);
  }

  log(`Fired OK: "${reminder.text}"`);
}

async function checkCycle() {
  const data = await readReminders();
  if (!data || !Array.isArray(data.reminders)) return;

  const token = await getToken();
  if (!token) {
    log('No gateway token found, skipping cycle');
    return;
  }

  const now = Date.now();
  let changed = false;

  for (const r of data.reminders) {
    if (r.status !== 'pending') continue;

    const dueMs = new Date(r.due).getTime();
    if (dueMs > now) continue;

    const overdueMs = now - dueMs;

    if (overdueMs > STALE_THRESHOLD_MS) {
      log(`Stale (${Math.round(overdueMs / 60000)}min overdue), marking fired: "${r.text}"`);
      r.status = 'fired';
      changed = true;
      continue;
    }

    try {
      await fireReminder(r, token);
      r.status = 'fired';
      changed = true;
    } catch (err) {
      log(`Failed to fire "${r.text}": ${err.message} (will retry next cycle)`);
    }
  }

  if (changed) {
    await writeReminders(data);
  }
}

async function main() {
  log(`Starting (delay ${STARTUP_DELAY_MS / 1000}s for gateway init)...`);
  await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));
  log(`Running. Checking every ${CHECK_INTERVAL_MS / 1000}s`);
  log(`Reminders file: ${REMINDERS_PATH}`);
  log(`Gateway: ${GATEWAY_URL}`);

  while (true) {
    try {
      await checkCycle();
    } catch (err) {
      log(`Cycle error: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

main();
