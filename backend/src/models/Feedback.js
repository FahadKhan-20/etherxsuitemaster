const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      trim: true,
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
