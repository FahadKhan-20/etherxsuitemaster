const express = require('express');
const auth = require('../middleware/auth');
const MeetingSession = require('../models/MeetingSession');

const router = express.Router();

// Finished meetings the signed-in user hosted or attended, newest first.
router.get('/', auth, async (req, res, next) => {
  try {
    const sessions = await MeetingSession.find({ $or: [{ host: req.user.id }, { 'participants.user': req.user.id }] })
      .sort({ startedAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, data: { sessions } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
