const express = require('express');
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, async (req, res, next) => {
  try {
    const { text, roomCode, rating } = req.body;
    if ((!text || !String(text).trim()) && !(Number.isInteger(rating)&&rating>=1&&rating<=5)) {
      return res.status(400).json({ success: false, message: 'Feedback text is required.' });
    }

    await Feedback.create({
      text: String(text||'').trim() || `Call rating: ${rating}/5`,
      rating: Number.isInteger(rating)&&rating>=1&&rating<=5?rating:null,
      roomCode: roomCode || null,
      submittedBy: req.user.id,
    });

    return res.status(201).json({ success: true, message: 'Feedback received. Thank you!' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
