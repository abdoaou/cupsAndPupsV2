const jwt = require('jsonwebtoken');
const { createHash, randomBytes } = require('crypto');
const argon2 = require('argon2');
const { config } = require('../config');
const { prisma } = require('./prisma');
const { HttpError } = require('./http');

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  createdAt: true,
};

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationToDays(value) {
  const match = /^(\d+)([dhms])$/.exec(value);
  if (!match) return 7;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'd') return amount;
  if (unit === 'h') return Math.max(1, Math.ceil(amount / 24));
  if (unit === 'm') return Math.max(1, Math.ceil(amount / (60 * 24)));
  if (unit === 's') return Math.max(1, Math.ceil(amount / (60 * 60 * 24)));
  return 7;
}

async function issueTokens(userId, email, role) {
  const accessToken = jwt.sign(
    { sub: userId, email, role },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiresIn },
  );

  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + parseDurationToDays(config.jwtRefreshExpiresIn),
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.jwtAccessExpiresIn,
  };
}

async function register({ email, password, firstName, lastName, phone }) {
  if (!email || !password || !firstName || !lastName) {
    throw new HttpError(400, 'Missing required fields');
  }
  if (String(password).length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  if (phone) {
    const phoneTaken = await prisma.user.findUnique({ where: { phone } });
    if (phoneTaken) {
      throw new HttpError(409, 'An account with this phone already exists');
    }
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || null,
      role: 'CUSTOMER',
      loyaltyAccount: { create: {} },
    },
    select: USER_SAFE_SELECT,
  });

  const tokens = await issueTokens(user.id, user.email, user.role);
  return { user, ...tokens };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: String(email || '').toLowerCase() },
  });

  if (!user || !user.passwordHash || !user.isActive) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const valid = await argon2.verify(user.passwordHash, password || '');
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user.id, user.email, user.role);
  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new HttpError(401, 'Invalid or expired refresh token');

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: USER_SAFE_SELECT } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(
    stored.user.id,
    stored.user.email,
    stored.user.role,
  );
  return { user: stored.user, ...tokens };
}

async function logout(refreshToken) {
  if (!refreshToken) return { success: true };
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
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
  USER_SAFE_SELECT,
  register,
  login,
  refresh,
  logout,
  verifyAccessToken,
};
