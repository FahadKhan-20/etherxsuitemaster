const express = require('express');
const auth = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const { publicKey } = require('../push');

const router = express.Router();

// The browser needs this key to subscribe; null means push is not set up on this server.
router.get('/key', (_req, res) => res.json({ success: true, publicKey: publicKey() }));

const validSubscription = sub => sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1000
  && typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string' && sub.keys.p256dh.length < 200 && sub.keys.auth.length < 100;

router.post('/subscribe', auth, async (req, res, next) => {
  try {
    if (!publicKey()) return res.status(503).json({ success: false, message: 'Notifications are not set up on the server yet.' });
    if (!validSubscription(req.body?.subscription)) return res.status(400).json({ success: false, message: 'Invalid push subscription.' });
    await PushSubscription.save(req.user.id, req.body.subscription);
    return res.status(201).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/unsubscribe', auth, async (req, res, next) => {
  try {
    if (typeof req.body?.endpoint === 'string') await PushSubscription.remove(req.body.endpoint, req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
