const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailjs = require('@emailjs/nodejs');
const passport = require('passport');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { issueNonce, verifyNonceSignature } = require('../utils/web3authNonce');

const sendResetEmail = async (toEmail, toName, resetUrl) => {
  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    {
      to_email: toEmail,
      to_name:  toName || 'User',
      reset_url: resetUrl,
    },
    {
      publicKey:  process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    }
  );
};

const router = express.Router();

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

const sanitizeUser = (user) => {
  const plainUser = user.toObject ? user.toObject() : { ...user };
  delete plainUser.password;
  return plainUser;
};

// ── Password auth ────────────────────────────────────────────────────────────

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: 'local',
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google or Web3Auth sign-in. Continue with that method to log in.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Return success regardless to avoid email enumeration
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

    try {
      await sendResetEmail(user.email, user.name, resetUrl);
    } catch (emailErr) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({ success: false, message: 'Failed to send reset email. Check SMTP config.' });
    }

    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'New password is required.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    return next(error);
  }
});

// ── Google OAuth (Passport) ──────────────────────────────────────────────────

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
  }),
  async (req, res) => {
    const token = signToken(req.user);
    const callbackUrl = new URL('/auth/callback', process.env.CLIENT_URL || 'http://localhost:3000');
    callbackUrl.searchParams.set('token', token);
    return res.redirect(callbackUrl.toString());
  }
);

// ── Web3Auth (MetaMask Embedded Wallets) — wallet-signature verification ──────
//
// Identity is proven by having the user's Web3Auth-embedded wallet sign a
// server-issued nonce; the backend recovers the signer address (ethers) and
// confirms it matches the claimed wallet. Trust is anchored on wallet
// ownership (the app's user identity) rather than the Web3Auth idToken's
// signature — the sapphire_devnet signing key is not published at either
// documented JWKS endpoint, so verifying that signature is not possible.
// email/name/avatar are treated as unverified profile data, so accounts are
// keyed strictly by wallet address (no auto-linking to existing accounts by
// email, which would be a takeover vector with an unverified email).

const VALID_LOGIN_METHODS = ['google', 'email_passwordless', 'discord', 'wallet'];

// Step 1: client requests a one-time challenge to sign.
router.post('/web3auth/nonce', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'walletAddress is required.' });
  }
  const nonce = issueNonce(walletAddress);
  return res.json({ success: true, data: { nonce } });
});

// Step 2: client returns the signed nonce; backend verifies and issues a session.
router.post('/web3auth', async (req, res, next) => {
  try {
    const { walletAddress, nonce, signature, email, name, avatar, loginMethod } = req.body;

    if (!walletAddress || !nonce || !signature) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress, nonce, and signature are required.',
      });
    }

    let normalizedWallet;
    try {
      normalizedWallet = verifyNonceSignature(walletAddress, nonce, signature);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        message: verifyError.message || 'Wallet signature verification failed.',
      });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
    const normalizedAuthProvider = VALID_LOGIN_METHODS.includes(loginMethod) ? loginMethod : 'wallet';

    // Identity is the (cryptographically proven) wallet address.
    let user = await User.findOne({ walletAddress: normalizedWallet });

    if (!user) {
      // New wallet user. Only attach the (unverified) email as profile data if
      // no other account already uses it — never link/take-over by email.
      const emailFree = normalizedEmail
        ? !(await User.findOne({ email: normalizedEmail }))
        : false;

      user = await User.create({
        name: name || (normalizedEmail ? normalizedEmail.split('@')[0] : null) || 'EtherXMeet User',
        ...(emailFree ? { email: normalizedEmail } : {}),
        walletAddress: normalizedWallet,
        avatar: avatar || null,
        authProvider: normalizedAuthProvider,
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

// ── Shared ────────────────────────────────────────────────────────────────────

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
      data: {
        user,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/me', auth, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (email && email.trim()) updates.email = email.trim().toLowerCase();

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

  // 1. Prioritize Wi-Fi/wlan/ethernet physical adapters
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

  // 2. Fallback to any other IPv4 (excluding link-local)
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
