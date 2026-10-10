// Collects real per-session meeting metrics in memory and saves one MeetingSession document when a session ends.
function createMeetingMetrics({
  now = Date.now,
  save = doc => {
    if (!require('./config/db').isConnected()) return Promise.resolve(); // no database (e.g. unit tests)
    return require('./models/MeetingSession').create(doc);
  },
  log = console.error,
} = {}) {
  const sessions = new Map(); // roomCode -> { host, startedAt, attendance: Map(userId -> {...}), counts }

  const start = (code, host) => {
    sessions.set(code, { host: host ? String(host) : null, startedAt: now(), attendance: new Map(), counts: { chat: 0, hands: 0, reactions: 0 } });
  };

  // An account may join from several tabs: time counts while at least one is in the room.
  const joined = (code, userId, name) => {
    const session = sessions.get(code);
    if (!session || !userId) return;
    const entry = session.attendance.get(String(userId)) || { name, seconds: 0, tabs: 0, since: null };
    entry.name = name || entry.name;
    if (entry.tabs++ === 0) entry.since = now();
    session.attendance.set(String(userId), entry);
  };

  const left = (code, userId) => {
    const entry = sessions.get(code)?.attendance.get(String(userId));
    if (!entry || entry.tabs === 0) return;
    if (--entry.tabs === 0) { entry.seconds += Math.round((now() - entry.since) / 1000); entry.since = null; }
  };

  const count = (code, kind) => {
    const session = sessions.get(code);
    if (session && kind in session.counts) session.counts[kind] += 1;
  };

  const finish = async code => {
    const session = sessions.get(code);
    if (!session) return;
    sessions.delete(code);
    const endedAt = now();
    const participants = [...session.attendance].map(([user, e]) => ({
      user, name: e.name, seconds: e.seconds + (e.tabs ? Math.round((endedAt - e.since) / 1000) : 0),
    }));
    if (!participants.length) return;
    try {
      await save({ roomCode: code, host: session.host, startedAt: new Date(session.startedAt), endedAt: new Date(endedAt), participants, counts: session.counts });
    } catch (error) {
      log('Could not save meeting metrics:', error.message);
    }
  };

  return { start, joined, left, count, finish, has: code => sessions.has(code) };
}

module.exports = { createMeetingMetrics, meetingMetrics: createMeetingMetrics() };
