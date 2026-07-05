const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { ACCESS_COOKIE_OPTS, REFRESH_COOKIE_OPTS } = require('../utils/token');
const env = require('../config/env');

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.register({ name, email, password });
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ success: true, data: { user: user.toSafeJSON(), accessToken } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login({
    email,
    password,
    userAgent: req.headers['user-agent'],
  });
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true, data: { user: user.toSafeJSON(), accessToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  const { user, accessToken, refreshToken } = await authService.refresh({ refreshToken: token });
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true, data: { user: user.toSafeJSON(), accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  await authService.logout({ userId: req.user?._id, refreshToken: token });
  res.clearCookie('accessToken', ACCESS_COOKIE_OPTS);
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll({ userId: req.user._id });
  res.clearCookie('accessToken', ACCESS_COOKIE_OPTS);
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out from all devices' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
});

// Called after passport's Google strategy succeeds; issues our own JWTs and redirects to frontend.
const googleCallback = asyncHandler(async (req, res) => {
  const { issueTokens } = authService;
  const { accessToken, refreshToken } = await issueTokens(req.user);
  setAuthCookies(res, accessToken, refreshToken);
  res.redirect(`${env.clientUrl}/auth/callback?token=${accessToken}`);
});

module.exports = { register, login, refresh, logout, logoutAll, me, googleCallback };
