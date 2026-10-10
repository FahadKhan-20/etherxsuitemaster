const express = require('express');
const auth = require('../middleware/auth');
const MeetingSession = require('../models/MeetingSession');

const router = express.Router();

// Finished meetings the signed-in user hosted or attended, newest first.
router.get('/', auth, async (req, res, next) => {
  try {
    const sessions = await MeetingSession.findForUser(req.user.id);
    return res.json({ success: true, data: { sessions } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
