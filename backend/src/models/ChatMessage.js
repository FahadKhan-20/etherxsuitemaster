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
        senderUserId: {
            type: String,
            required: false,
            trim: true,
            index: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        audience: {
            type: String,
            enum: ['everyone', 'host'],
            default: 'everyone',
            index: true,
        },
        sequence: {
            type: Number,
            required: false,
            index: true,
        },
        clientMessageId: {
            type: String,
            required: false,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

chatMessageSchema.index({ roomCode: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);