const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000, // 15 min short-lived cookie mirror of JWT; primary auth is bearer token
};

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  path: '/api/auth/refresh',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  randomToken,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
};
