const { query } = require('../config/db');

const toRoom = row => row && {
  roomCode: row.room_code,
  hostUserId: row.host_user_id,
  hostName: row.host_name,
  lastActiveAt: row.last_active_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

const findByCode = async roomCode => toRoom((await query('select * from meeting_rooms where room_code = $1', [String(roomCode).trim().toLowerCase()])).rows[0]) || null;

/** Rejects with code '23505' (unique violation) when the room code is taken. */
const create = async ({ roomCode, hostUserId, hostName }) => toRoom((await query(
  'insert into meeting_rooms (room_code, host_user_id, host_name) values ($1, $2, $3) returning *',
  [String(roomCode).trim().toLowerCase(), String(hostUserId), hostName]
)).rows[0]);

/** The host reopened the room: refresh its display name and activity time. */
const touch = async (roomCode, hostName) => toRoom((await query(
  'update meeting_rooms set host_name = $2, last_active_at = now(), updated_at = now() where room_code = $1 returning *',
  [roomCode, hostName]
)).rows[0]) || null;

module.exports = { findByCode, create, touch };
