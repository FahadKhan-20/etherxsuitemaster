const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function scheduleTimezone(timezone) {
  try {
    const resolved = new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone;
    return timezone || resolved;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

function dateParts(date, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function dateInTimezone(date, timezone) {
  const parts = dateParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function tomorrowInTimezone(timezone, now = Date.now()) {
  const day = new Date(`${dateInTimezone(now, timezone)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** Resolve wall-clock input in the account's timezone, including DST gaps and overlaps. */
export function scheduleStart(date, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return [];
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return [];
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const calendar = new Date(wallTime);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return [];
  const offsets = new Set([-36, 0, 36].map((hours) => {
    const instant = wallTime + hours * 3600_000;
    const parts = dateParts(instant, timezone);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)) - instant;
  }));
  return [...offsets].map((offset) => wallTime - offset).filter((instant) => {
    const parts = dateParts(instant, timezone);
    return `${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time;
  }).sort((a, b) => a - b);
}

export function validateSchedule(form, timezone, now = Date.now()) {
  const errors = {};
  const title = form.title.trim();
  if (!title) errors.title = 'Give the meeting a title.';
  else if (title.length > 120) errors.title = 'Keep the title under 121 characters.';
  if (!form.date) errors.date = 'Choose a date.';
  if (!form.time) errors.time = 'Choose a time.';
  const starts = form.date && form.time ? scheduleStart(form.date, form.time, timezone) : [];
  if (form.date && form.time) {
    if (!starts.length) errors.time = `Choose a valid date and time in ${timezone}. Some times are skipped by daylight saving.`;
    else if (starts.length > 1) errors.time = `This time occurs twice in ${timezone} due to daylight saving. Choose another time.`;
    else if (starts[0] <= now) errors.time = 'Choose a future date and time.';
  }
  const duration = Number(form.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) errors.duration = 'Choose a duration between 5 and 480 minutes.';
  const entries = form.participants.trim() ? form.participants.split(',').map((email) => email.trim().toLowerCase()) : [];
  const invalid = entries.find((email) => !email || email.length > 254 || !EMAIL.test(email));
  if (entries.some((email) => !email || email.length > 254 || !EMAIL.test(email))) {
    errors.participants = invalid ? `Check this email address: ${invalid}` : 'Remove empty email entries between commas.';
  }
  const participants = [...new Set(entries)];
  if (participants.length > 100) errors.participants = 'Invite up to 100 email addresses.';
  return {
    errors,
    input: Object.keys(errors).length ? null : { title, startAt: new Date(starts[0]).toISOString(), duration, recurring: form.recurring, participants },
  };
}
