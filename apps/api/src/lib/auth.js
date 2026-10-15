const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { config } = require('../config');
const { HttpError } = require('./http');
const { findAdminByLogin, publicAdmin } = require('./live-store');

function signAccess(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiresIn },
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, typ: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn },
  );
}

function issueTokens(user) {
  return {
    accessToken: signAccess(user),
    refreshToken: signRefresh(user),
    tokenType: 'Bearer',
    expiresIn: config.jwtAccessExpiresIn,
  };
}

async function register() {
  throw new HttpError(
    400,
    'Customer accounts are not set up yet. You can book grooming without an account.',
  );
}

async function login({ email, password }) {
  const row = await findAdminByLogin(email);
  if (!row || !row.password) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(String(password || ''), row.password);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const user = publicAdmin(row);
  return { user, ...issueTokens(user) };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new HttpError(401, 'Invalid or expired refresh token');
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }
  if (payload.typ !== 'refresh' || payload.role !== 'ADMIN') {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }

  const { findAdminById } = require('./live-store');
  const row = await findAdminById(payload.sub);
  if (!row) throw new HttpError(401, 'Invalid or expired refresh token');
  const user = publicAdmin(row);
  return { user, ...issueTokens(user) };
}

async function logout() {
  return { success: true };
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwtAccessSecret);
  } catch {
    throw new HttpError(401, 'Authentication required');
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyAccessToken,
};
