const { query } = require('../config/db');

const toMessage = row => ({
  _id: row.id,
  roomCode: row.room_code,
  address: row.address,
  senderId: row.sender_id,
  message: row.message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const create = async ({ roomCode, address, senderId, message }) => toMessage((await query(
  'insert into chat_messages (room_code, address, sender_id, message) values ($1, $2, $3, $4) returning *',
  [roomCode, String(address).trim(), senderId || null, String(message).trim()]
)).rows[0]);

/** A room's messages sent at or after `since`, oldest first. */
const findSince = async (roomCode, since) =>
  (await query('select * from chat_messages where room_code = $1 and created_at >= $2 order by created_at', [roomCode, since])).rows.map(toMessage);

module.exports = { create, findSince };
