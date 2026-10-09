const mongoose = require('mongoose');

/** Whether the owner of this account allows recording in meetings they host (default yes). */
async function hostAllowsRecording(ownerId) {
  if (!ownerId || mongoose.connection.readyState !== 1) return true; // no database (unit tests)
  const User = require('./models/User');
  const owner = await User.findById(ownerId).select('preferences.privacy.allowRecording').lean();
  return owner?.preferences?.privacy?.allowRecording !== false;
}

/** Same check, by room code, for uploads that arrive after the meeting. */
async function roomAllowsRecording(roomCode) {
  const MeetingRoom = require('./models/MeetingRoom');
  const room = await MeetingRoom.findOne({ roomCode }).lean();
  if (!room?.hostUserId) return true;
  const User = require('./models/User');
  const owner = await User.findById(String(room.hostUserId)).select('preferences.privacy.allowRecording').lean();
  return owner?.preferences?.privacy?.allowRecording !== false;
}

module.exports = { hostAllowsRecording, roomAllowsRecording };
