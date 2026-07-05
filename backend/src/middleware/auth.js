const passport = require('passport');
const ApiError = require('../utils/ApiError');

/**
 * Requires a valid JWT (from Authorization header or accessToken cookie).
 * Attaches req.user on success.
 */
const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) return next(ApiError.unauthorized('Invalid or expired session. Please log in again.'));
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Attaches req.user if a valid token is present, but does not fail the request otherwise.
 */
const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user;
    next();
  })(req, res, next);
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

module.exports = { requireAuth, optionalAuth, requireAdmin };
