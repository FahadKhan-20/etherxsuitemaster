const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
    {
        roomCode: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

chatMessageSchema.index({ roomCode: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);