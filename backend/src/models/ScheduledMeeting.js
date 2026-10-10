const { query, isId } = require('../config/db');

const toMeeting = row => row && {
  _id: row.id,
  owner: row.owner,
  title: row.title,
  startAt: row.start_at,
  duration: row.duration,
  recurring: row.recurring,
  participants: row.participants,
  roomCode: row.room_code,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

const findByOwner = async ownerId =>
  (await query('select * from scheduled_meetings where owner = $1 order by start_at', [String(ownerId)])).rows.map(toMeeting);

const create = async ({ owner, title, startAt, duration, recurring = 'none', participants = [], roomCode }) => toMeeting((await query(
  `insert into scheduled_meetings (owner, title, start_at, duration, recurring, participants, room_code)
   values ($1, $2, $3, $4, $5, $6, $7) returning *`,
  [String(owner), title, startAt, duration, recurring, participants, String(roomCode).trim().toLowerCase()]
)).rows[0]);

/** Deletes the meeting only if this user owns it; resolves to the deleted meeting or null. */
const deleteOwned = async (id, ownerId) => (isId(String(id))
  ? toMeeting((await query('delete from scheduled_meetings where id = $1 and owner = $2 returning *', [String(id), String(ownerId)])).rows[0]) || null
  : null);

module.exports = { findByOwner, create, deleteOwned };
