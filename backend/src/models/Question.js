const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    upvotes: {
      type: Number,
      default: 0,
    },
    upvotedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['OPEN', 'ANSWERED'],
      default: 'OPEN',
    },
    answeredBy: {
      type: String,
      default: null,
    },
    answeredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for efficient per-room queries sorted by votes then date
questionSchema.index({ roomCode: 1, upvotes: -1, createdAt: -1 });
questionSchema.index({ roomCode: 1, status: 1, upvotes: -1, createdAt: -1 });

module.exports = mongoose.model('Question', questionSchema);
