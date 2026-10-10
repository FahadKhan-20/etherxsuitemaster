const { isConnected } = require('./config/db');

/** Whether the owner of this account allows recording in meetings they host (default yes). */
async function hostAllowsRecording(ownerId) {
  if (!ownerId || !isConnected()) return true; // no database (unit tests)
  return require('./models/User').allowsRecording(ownerId);
}

/** Same check, by room code, for uploads that arrive after the meeting. */
async function roomAllowsRecording(roomCode) {
  const room = await require('./models/MeetingRoom').findByCode(roomCode);
  if (!room?.hostUserId) return true;
  return require('./models/User').allowsRecording(room.hostUserId);
}

module.exports = { hostAllowsRecording, roomAllowsRecording };
