const express = require('express');
const mongoose = require('mongoose');
const { randomInt } = require('crypto');
const auth = require('../middleware/auth');
const ScheduledMeeting = require('../models/ScheduledMeeting');
const MeetingRoom = require('../models/MeetingRoom');
const { registerRoomHost } = require('../signaling');

const router = express.Router();
const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newRoomCode = () => 'etherx-' + Array.from({ length: 10 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

router.get('/', auth, async (req, res, next) => {
  try {
    const meetings = await ScheduledMeeting.find({ owner: req.user.id }).sort({ startAt: 1 }).lean();
    return res.json({ success: true, data: { meetings } });
  } catch (error) {
    return next(error);
  }
});

// Creates the schedule and registers its room up front, so the calendar invite, the dashboard and the
// meeting itself all use the same room code, with the scheduler as host.
router.post('/', auth, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const startAt = new Date(req.body?.startAt);
    const duration = Number(req.body?.duration);
    const recurring = req.body?.recurring || 'none';
    const participants = (Array.isArray(req.body?.participants) ? req.body.participants : [])
      .map(email => String(email).trim().toLowerCase())
      .filter(email => email.length <= 254 && EMAIL.test(email))
      .slice(0, 100);

    if (!title) return res.status(400).json({ success: false, message: 'Give the meeting a title.' });
    if (Number.isNaN(startAt.getTime())) return res.status(400).json({ success: false, message: 'Choose a valid date and time.' });
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return res.status(400).json({ success: false, message: 'Duration must be between 1 and 1440 minutes.' });
    if (!['none', 'daily', 'weekly'].includes(recurring)) return res.status(400).json({ success: false, message: 'Repeat must be none, daily or weekly.' });

    const roomCode = newRoomCode();
    await MeetingRoom.create({ roomCode, hostUserId: req.user.id, hostName: req.user.name || 'Host', lastActiveAt: new Date() });
    registerRoomHost(roomCode, req.user.id, req.app?.get?.('io'));
    const meeting = await ScheduledMeeting.create({ owner: req.user.id, title, startAt, duration, recurring, participants, roomCode });
    return res.status(201).json({ success: true, data: { meeting } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Scheduled meeting not found.' });
    const meeting = await ScheduledMeeting.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!meeting) return res.status(404).json({ success: false, message: 'Scheduled meeting not found.' });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
