require('dotenv').config();

function required(name, fallback = undefined) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    // Don't crash on import in dev; server.js validates critical ones at boot.
    return undefined;
  }
  return val;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:5000',

  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/archon'),

  redis: {
    url: process.env.REDIS_URL || undefined,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev_insecure_secret_change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_insecure_refresh_secret_change_me'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },

  cookieSecret: process.env.COOKIE_SECRET || 'dev_cookie_secret',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
  },

  clone: {
    tmpDir: process.env.CLONE_TMP_DIR || '/tmp/archon-repos',
    maxRepoSizeMb: parseInt(process.env.MAX_REPO_SIZE_MB || '250', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },
};
