const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const env = require('./env');
const User = require('../models/User');
const logger = require('./logger');

// --- JWT Strategy (for protecting API routes) ---
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    (req) => (req && req.cookies ? req.cookies.accessToken : null),
  ]),
  secretOrKey: env.jwt.secret,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.sub).select('-password');
      if (!user) return done(null, false);
      if (user.isDisabled) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  })
);

// --- Google OAuth Strategy ---
if (env.google.clientId && env.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: env.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] && profile.emails[0].value;
          if (!email) return done(new Error('Google account has no public email'), null);

          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

          if (user) {
            if (!user.googleId) {
              user.googleId = profile.id;
              user.authProvider = user.authProvider === 'local' ? 'local' : 'google';
              if (!user.avatarUrl && profile.photos && profile.photos[0]) {
                user.avatarUrl = profile.photos[0].value;
              }
              await user.save();
            }
          } else {
            user = await User.create({
              email,
              name: profile.displayName || email.split('@')[0],
              googleId: profile.id,
              authProvider: 'google',
              avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
              isEmailVerified: true,
            });
          }

          return done(null, user);
        } catch (err) {
          logger.error(`Google OAuth error: ${err.message}`);
          return done(err, null);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing) — skipping strategy registration');
}

module.exports = passport;
