const { query } = require('../config/db');

// One finished meeting session, recorded by the signaling server for analytics.
const toSession = row => ({
  _id: row.id,
  roomCode: row.room_code,
  host: row.host,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  participants: row.participants,
  counts: row.counts,
});

const create = ({ roomCode, host, startedAt, endedAt, participants, counts }) => query(
  'insert into meeting_sessions (room_code, host, started_at, ended_at, participants, counts) values ($1, $2, $3, $4, $5, $6)',
  [String(roomCode).trim().toLowerCase(), host || null, startedAt, endedAt, JSON.stringify(participants), JSON.stringify(counts)]
);

/** Sessions the user hosted or attended, newest first. */
const findForUser = async (userId, limit = 200) => (await query(
  `select * from meeting_sessions where host::text = $1 or participants @> jsonb_build_array(jsonb_build_object('user', $1::text))
   order by started_at desc limit $2`,
  [String(userId), limit]
)).rows.map(toSession);

/** Deletes sessions this user hosted that ended before `cutoff`; resolves to the count. */
const deleteHostedBefore = async (hostId, cutoff) =>
  (await query('delete from meeting_sessions where host = $1 and ended_at < $2', [hostId, cutoff])).rowCount;

module.exports = { create, findForUser, deleteHostedBefore };
