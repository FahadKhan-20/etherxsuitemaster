const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function configurePassport() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    console.warn('Google OAuth is not fully configured. Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_CALLBACK_URL.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            return done(new Error('Google account email is required for login.'));
          }

          let user = await User.findByProviderOrEmail('google', profile.id, email);

          if (!user) {
            user = await User.create({
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              authProvider: 'google',
              avatar: profile.photos?.[0]?.value || null,
            });
          } else {
            user = await User.update(user._id, {
              googleId: user.googleId || profile.id,
              authProvider: 'google',
              avatar: user.avatar || profile.photos?.[0]?.value || null,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};
