const mongoose = require('mongoose');

const scheduledMeetingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    startAt: { type: Date, required: true },
    duration: { type: Number, required: true, min: 1, max: 1440 }, // minutes
    recurring: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
    participants: { type: [String], default: [] },
    // Registered MeetingRoom code; the scheduler owns the room and is its host.
    roomCode: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('ScheduledMeeting', scheduledMeetingSchema);
