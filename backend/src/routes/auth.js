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
  const templateParams = {
    to_email: toEmail,
    email: toEmail,
    user_email: toEmail,
    recipient_email: toEmail,
    to_name: toName || 'User',
    name: toName || 'User',
    user_name: toName || 'User',
    reset_url: resetUrl,
    reset_link: resetUrl,
    url: resetUrl,
    link: resetUrl,
    message: `Reset your EtherXMeet password by visiting: ${resetUrl}`,
  };

  const result = await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    templateParams,
    {
      publicKey:  process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    }
  );
  console.log('✅ EMAILJS DISPATCH SUCCESS:', result.status, result.text);
  return result;
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
      if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY) {
        await sendResetEmail(user.email, user.name, resetUrl);
      } else {
        console.log('\n==================================================');
        console.log(`🔑 PASSWORD RESET LINK FOR ${user.email}:`);
        console.log(resetUrl);
        console.log('==================================================\n');
      }
    } catch (emailErr) {
      console.warn('EmailJS dispatch notice:', emailErr?.message || emailErr);
      console.log('\n==================================================');
      console.log(`🔑 PASSWORD RESET LINK FOR ${user.email}:`);
      console.log(resetUrl);
      console.log('==================================================\n');
    }

    return res.json({ success: true, message: 'If that email exists, a password reset link has been sent!' });
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

// ── Apple Sign-In ────────────────────────────────────────────────────────────

// 1. Direct ID Token verification (Apple Web JS SDK / Native / Web3Auth Apple login)
router.post('/apple', async (req, res, next) => {
  try {
    const { idToken, name, email } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Apple idToken is required for Apple sign-in.',
      });
    }

    // Decode Apple JWT payload
    let decoded;
    try {
      decoded = jwt.decode(idToken);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid Apple ID Token.' });
    }

    if (!decoded || !decoded.sub) {
      return res.status(400).json({ success: false, message: 'Apple ID Token is missing subject identifier.' });
    }

    const appleSub = decoded.sub;
    const userEmail = (decoded.email || email || `${appleSub}@privaterelay.appleid.com`).toLowerCase();
    const userName = name || (decoded.email ? decoded.email.split('@')[0] : 'Apple User');

    let user = await User.findOne({ $or: [{ appleId: appleSub }, { email: userEmail }] });

    if (!user) {
      user = await User.create({
        name: userName,
        email: userEmail,
        appleId: appleSub,
        authProvider: 'apple',
      });
    } else {
      if (!user.appleId) user.appleId = appleSub;
      if (user.authProvider !== 'apple') user.authProvider = 'apple';
      await user.save();
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

// 2. Browser redirect OAuth trigger for Apple Sign-In
router.get('/apple', (req, res) => {
  const clientId = process.env.APPLE_CLIENT_ID;
  const redirectUri = process.env.APPLE_CALLBACK_URL || `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/apple/callback`;

  if (!clientId) {
    return res.redirect(
      `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=apple_config_missing`
    );
  }

  const appleAuthUrl = new URL('https://appleid.apple.com/auth/authorize');
  appleAuthUrl.searchParams.set('client_id', clientId);
  appleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  appleAuthUrl.searchParams.set('response_type', 'code id_token');
  appleAuthUrl.searchParams.set('response_mode', 'form_post');
  appleAuthUrl.searchParams.set('scope', 'name email');

  return res.redirect(appleAuthUrl.toString());
});

// 3. Apple OAuth form_post callback handler
router.post('/apple/callback', async (req, res, next) => {
  try {
    const { id_token, user: userJson } = req.body;
    if (!id_token) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=apple_auth_failed`);
    }

    let decoded = jwt.decode(id_token);
    if (!decoded || !decoded.sub) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=apple_auth_invalid`);
    }

    let name = 'Apple User';
    if (userJson) {
      try {
        const parsed = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
        if (parsed.name) {
          name = `${parsed.name.firstName || ''} ${parsed.name.lastName || ''}`.trim() || name;
        }
      } catch (e) {}
    }

    const appleSub = decoded.sub;
    const userEmail = (decoded.email || `${appleSub}@privaterelay.appleid.com`).toLowerCase();

    let user = await User.findOne({ $or: [{ appleId: appleSub }, { email: userEmail }] });

    if (!user) {
      user = await User.create({
        name,
        email: userEmail,
        appleId: appleSub,
        authProvider: 'apple',
      });
    } else {
      if (!user.appleId) user.appleId = appleSub;
      await user.save();
    }

    const token = signToken(user);
    const callbackUrl = new URL('/auth/callback', process.env.CLIENT_URL || 'http://localhost:3000');
    callbackUrl.searchParams.set('token', token);
    return res.redirect(callbackUrl.toString());
  } catch (error) {
    return next(error);
  }
});

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
