const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { verifyWeb3AuthToken } = require('../utils/verifyWeb3AuthToken');

const router = express.Router();

const VALID_LOGIN_METHODS = ['google', 'email_passwordless', 'discord', 'wallet'];

const resolveAuthProvider = (loginMethod) =>
  VALID_LOGIN_METHODS.includes(loginMethod) ? loginMethod : 'wallet';

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );

router.post('/web3auth', async (req, res, next) => {
  try {
    const { idToken, walletAddress, avatar, loginMethod } = req.body;

    if (!idToken || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'idToken and walletAddress are required.',
      });
    }

    let verified;
    try {
      verified = await verifyWeb3AuthToken(idToken, walletAddress, {
        clientId: process.env.WEB3AUTH_CLIENT_ID,
      });
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        message: verifyError.message || 'Invalid Web3Auth token.',
      });
    }

    const normalizedWallet = verified.walletAddress;
    const normalizedEmail = (verified.email || '').trim().toLowerCase();
    const resolvedAuthProvider = resolveAuthProvider(loginMethod);

    let user = await User.findOne({ walletAddress: normalizedWallet });

    if (!user && normalizedEmail) {
      // Migration path: link a pre-existing password-based account by email
      // instead of creating a duplicate, so its Recording history carries over.
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        user.walletAddress = normalizedWallet;
        if (avatar && !user.avatar) user.avatar = avatar;
        // Overwrite legacy/stale authProvider values (e.g. pre-migration 'local')
        // with the current login's validated value so schema enum validation
        // doesn't fail on save.
        user.authProvider = resolvedAuthProvider;
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        name: verified.name || normalizedEmail.split('@')[0] || 'EtherXMeet User',
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        walletAddress: normalizedWallet,
        avatar: avatar || null,
        authProvider: resolvedAuthProvider,
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      data: { token, user },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/me', auth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({ success: true, data: { user } });
  } catch (error) {
    return next(error);
  }
});

const os = require('os');

router.get('/local-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('ethernet')) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          localIp = iface.address;
          break;
        }
      }
    }
    if (localIp !== 'localhost') break;
  }

  if (localIp === 'localhost') {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }
  }

  res.json({ success: true, localIp });
});

module.exports = router;
