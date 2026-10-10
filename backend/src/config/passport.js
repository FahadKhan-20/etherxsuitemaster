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
          // Linking by email is only safe when Google has verified that the person owns the address.
          if (profile._json?.email_verified === false) {
            return done(new Error('Verify your Google account email before signing in.'));
          }

          // Password sign-up and Google sign-in with the same email are one account.
          let user = await User.findByProviderOrEmail('google', profile.id, email, { withPassword: true });

          if (!user) {
            user = await User.create({
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              authProvider: 'google',
              avatar: profile.photos?.[0]?.value || null,
            });
          } else {
            // Registering with a password never proved the email was the registrant's. When Google first
            // proves it, drop that password so whoever registered the address cannot keep a way in.
            // The owner can add a password again through "Forgot password".
            const firstGoogleLink = !user.googleId && user.password;
            user = await User.update(user._id, {
              ...(firstGoogleLink ? { password: null, resetPasswordToken: null, resetPasswordExpires: null } : {}),
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
