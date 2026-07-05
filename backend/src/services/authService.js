const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/token');

async function register({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email: email.toLowerCase(), password, authProvider: 'local' });
  return issueTokens(user);
}

async function login({ email, password, userAgent }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  if (user.authProvider === 'google' && !user.password) {
    throw ApiError.badRequest('This account uses Google Sign-In. Please continue with Google.');
  }

  const match = await user.comparePassword(password);
  if (!match) throw ApiError.unauthorized('Invalid email or password');
  if (user.isDisabled) throw ApiError.forbidden('This account has been disabled');

  user.lastLoginAt = new Date();
  return issueTokens(user, userAgent);
}

async function issueTokens(user, userAgent) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokens = user.refreshTokens || [];
  // Cap stored refresh tokens per user to prevent unbounded growth
  if (user.refreshTokens.length >= 10) user.refreshTokens.shift();
  user.refreshTokens.push({ token: refreshToken, userAgent });
  await user.save();

  return { user, accessToken, refreshToken };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token provided');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  const tokenExists = (user.refreshTokens || []).some((rt) => rt.token === refreshToken);
  if (!tokenExists) throw ApiError.unauthorized('Refresh token has been revoked');

  // Rotate: remove old, issue new
  user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  user.refreshTokens.push({ token: newRefreshToken });
  await user.save();

  return { user, accessToken, refreshToken: newRefreshToken };
}

async function logout({ userId, refreshToken }) {
  if (!userId) return;
  await User.updateOne({ _id: userId }, { $pull: { refreshTokens: { token: refreshToken } } });
}

async function logoutAll({ userId }) {
  await User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

module.exports = { register, login, refresh, logout, logoutAll, issueTokens };
