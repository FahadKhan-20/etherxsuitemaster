const { rateLimit } = require('express-rate-limit');

const tooMany = message => ({ success: false, message });

// Password guessing: only failed sign-ins count, so normal use never hits the limit.
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany('Too many failed sign-in attempts. Try again in 15 minutes.'),
});

// Account creation, password-reset email and wallet/Apple sign-in requests.
const accountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany('Too many requests. Try again later.'),
});

module.exports = { signInLimiter, accountLimiter };
