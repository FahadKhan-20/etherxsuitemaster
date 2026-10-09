const mongoose = require('mongoose');

// One finished meeting session, recorded by the signaling server for analytics.
const meetingSessionSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, lowercase: true, trim: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    participants: [{
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
      name: String,
      seconds: Number, // total time in the meeting
    }],
    counts: { chat: Number, hands: Number, reactions: Number },
  },
  { versionKey: false }
);

module.exports = mongoose.model('MeetingSession', meetingSessionSchema);
