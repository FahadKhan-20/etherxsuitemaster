const mongoose = require("mongoose");

// Schema for each agenda topic
const agendaTopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);

// Main Meeting Agenda schema
const meetingAgendaSchema = new mongoose.Schema(
  {
    // Unique meeting room identifier
    roomCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Meeting agenda topics
    topics: {
      type: [agendaTopicSchema],
      default: [],
    },

    // Host who created the agenda
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MeetingAgenda", meetingAgendaSchema);