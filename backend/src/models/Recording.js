const { query, isId } = require('../config/db');

// uploadedBy is the owner's public profile, as the recordings page expects.
const SELECT = `select r.*, u.name as owner_name, u.email as owner_email, u.avatar as owner_avatar
  from recordings r join users u on u.id = r.uploaded_by`;

const toRecording = row => row && {
  _id: row.id,
  roomCode: row.room_code,
  uploadedBy: { _id: row.uploaded_by, name: row.owner_name, email: row.owner_email, avatar: row.owner_avatar },
  filename: row.filename,
  originalName: row.original_name,
  size: row.size,
  duration: row.duration,
  createdAt: row.created_at,
};

const findById = async id => (isId(String(id)) ? toRecording((await query(`${SELECT} where r.id = $1`, [String(id)])).rows[0]) || null : null);

/** The recording, only if this user owns it. */
const findOwned = async (id, ownerId) => (isId(String(id)) && isId(String(ownerId))
  ? toRecording((await query(`${SELECT} where r.id = $1 and r.uploaded_by = $2`, [String(id), String(ownerId)])).rows[0]) || null
  : null);

/** The owner's recordings, newest first; `before` limits them to older ones. */
const findByOwner = async (ownerId, { before } = {}) => (await query(
  `${SELECT} where r.uploaded_by = $1 and ($2::timestamptz is null or r.created_at < $2) order by r.created_at desc`,
  [String(ownerId), before || null]
)).rows.map(toRecording);

async function create({ roomCode, uploadedBy, filename, originalName = '', size = 0, duration = 0 }) {
  const { rows } = await query(
    'insert into recordings (room_code, uploaded_by, filename, original_name, size, duration) values ($1, $2, $3, $4, $5, $6) returning id',
    [roomCode, String(uploadedBy), filename, String(originalName).trim(), size, duration]
  );
  return findById(rows[0].id);
}

const remove = id => query('delete from recordings where id = $1', [String(id)]);

module.exports = { findById, findOwned, findByOwner, create, remove };
