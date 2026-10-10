// Push reminders before scheduled meetings, at each person's chosen lead time (Settings > Notifications).
// The owner and any invited people who have accounts are reminded; the in-app reminder still covers open tabs.
const { query, isConnected } = require('./config/db');
const { notifyUsers } = require('./push');

const MINUTE = 60 * 1000;
const PERIOD = { daily: 24 * 60 * MINUTE, weekly: 7 * 24 * 60 * MINUTE };
const sent = new Map(); // `${meetingId}:${start}:${userId}` -> when it was sent; avoids repeats within a run

/** The next start at or after `now` for a meeting (repeating ones step forward from their first start). */
function nextStart(startAt, recurring, now) {
  let start = new Date(startAt).getTime();
  const period = PERIOD[recurring];
  if (period && start < now) start += Math.ceil((now - start) / period) * period;
  return start;
}

/** Reminders due in [now, now + window): [{ meetingId, title, roomCode, start, userId }]. */
async function dueReminders(now = Date.now(), windowMs = MINUTE) {
  const { rows } = await query(
    `select sm.id, sm.title, sm.room_code, sm.start_at, sm.recurring, u.id as user_id, u.reminder_minutes
     from scheduled_meetings sm
     join users u on (u.id = sm.owner or u.email = any(sm.participants))
     where u.reminders_enabled
       and (sm.recurring <> 'none' or sm.start_at > now())`
  );
  return rows.flatMap(row => {
    const start = nextStart(row.start_at, row.recurring, now);
    const remindAt = start - row.reminder_minutes * MINUTE;
    return remindAt >= now && remindAt < now + windowMs
      ? [{ meetingId: row.id, title: row.title, roomCode: row.room_code, start, minutes: row.reminder_minutes, userId: row.user_id }]
      : [];
  });
}

async function sendDueReminders(now = Date.now()) {
  for (const [key, at] of sent) if (now - at > 2 * 60 * MINUTE) sent.delete(key);
  let count = 0;
  for (const r of await dueReminders(now)) {
    const key = `${r.meetingId}:${r.start}:${r.userId}`;
    if (sent.has(key)) continue;
    sent.set(key, now);
    count += await notifyUsers([r.userId], {
      title: `${r.title} starts in ${r.minutes >= 60 ? '1 hour' : `${r.minutes} minutes`}`,
      body: 'Tap to open the meeting room.',
      url: `/room/${r.roomCode}`,
      tag: `reminder-${r.meetingId}-${r.start}`,
    });
  }
  return count;
}

/** Checks once a minute while the server runs. */
function scheduleReminders() {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const timer = setInterval(() => {
    if (isConnected()) sendDueReminders().catch(error => console.error('Reminder push failed:', error.message));
  }, MINUTE);
  if (timer.unref) timer.unref();
}

module.exports = { nextStart, dueReminders, sendDueReminders, scheduleReminders };
