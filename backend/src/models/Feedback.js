const { query } = require('../config/db');

const create = ({ text, rating = null, roomCode = null, submittedBy = null }) => query(
  'insert into feedback (text, rating, room_code, submitted_by) values ($1, $2, $3, $4)',
  [String(text).trim(), rating, roomCode ? String(roomCode).trim() : null, submittedBy]
);

module.exports = { create };
