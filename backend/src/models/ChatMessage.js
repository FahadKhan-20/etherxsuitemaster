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
        sequence: {
            type: Number,
            required: true,
        },
        clientMessageId: {
            type: String,
            required: true,
        },
        senderUserId: {
            type: String,
            required: true,
        },
        audience: {
            type: String,
            enum: ['everyone', 'host'],
            default: 'everyone',
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

chatMessageSchema.index({ roomCode: 1, createdAt: 1 });
chatMessageSchema.index({ roomCode: 1, clientMessageId: 1 }, { unique: true, sparse: true });
chatMessageSchema.index({ roomCode: 1, sequence: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);