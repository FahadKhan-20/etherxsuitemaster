const express = require('express');
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, async (req, res, next) => {
  try {
    const { text, roomCode } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Feedback text is required.' });
    }

    await Feedback.create({
      text: text.trim(),
      roomCode: roomCode || null,
      submittedBy: req.user.id,
    });

    return res.status(201).json({ success: true, message: 'Feedback received. Thank you!' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
