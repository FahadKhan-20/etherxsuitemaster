const express = require('express');
const auth = require('../middleware/auth');
const MeetingRoom = require('../models/MeetingRoom');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

const normalizeRoomCode = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
router.get('/chat/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    const messages = await ChatMessage.find({ roomCode }).sort({ createdAt: 1 }).lean();

    return res.json({ success: true, data: messages });
  } catch (error) {
    return next(error);
  }
});

router.post('/chat/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    const sanitizedMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }
    if (!sanitizedMessage) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }
    if (sanitizedMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'Message must not exceed 1000 characters.' });
    }

    const chatMessage = await ChatMessage.create({
      roomCode,
      address: req.user.name || 'Participant',
      message: sanitizedMessage,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(roomCode).emit('chat:message-created', chatMessage);
    }

    return res.status(201).json({ success: true, data: chatMessage });
  } catch (error) {
    return next(error);
  }
});

router.post('/', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.body?.roomCode);
    const hostName = typeof req.body?.hostName === 'string' && req.body.hostName.trim()
      ? req.body.hostName.trim()
      : req.user.name || 'Host';

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'roomCode is required.' });
    }

    const existingRoom = await MeetingRoom.findOne({ roomCode });

    if (existingRoom) {
      if (String(existingRoom.hostUserId) !== String(req.user.id)) {
        return res.status(409).json({
          success: false,
          message: 'This room is already owned by another host.',
        });
      }

      existingRoom.hostName = hostName;
      existingRoom.lastActiveAt = new Date();
      await existingRoom.save();

      return res.json({
        success: true,
        data: {
          roomCode: existingRoom.roomCode,
          hostName: existingRoom.hostName,
          hostUserId: existingRoom.hostUserId,
          createdAt: existingRoom.createdAt,
          updatedAt: existingRoom.updatedAt,
        },
      });
    }

    const room = await MeetingRoom.create({
      roomCode,
      hostUserId: req.user.id,
      hostName,
      lastActiveAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        roomCode: room.roomCode,
        hostName: room.hostName,
        hostUserId: room.hostUserId,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This room code has already been claimed.',
      });
    }

    return next(error);
  }
});

router.get('/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    const room = await MeetingRoom.findOne({ roomCode }).lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    return res.json({
      success: true,
      data: {
        roomCode: room.roomCode,
        hostName: room.hostName,
        isHost: String(room.hostUserId) === String(req.user.id),
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;