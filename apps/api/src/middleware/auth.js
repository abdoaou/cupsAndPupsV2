const { prisma } = require('../lib/prisma');
const { verifyAccessToken } = require('../lib/auth');
const { HttpError, asyncHandler } = require('../lib/http');

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.auth = verifyAccessToken(token);
  } catch {
    // ignore invalid token for optional routes
  }
  return next();
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, 'User inactive or not found');
  }

  req.user = user;
  next();
});

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (req.user.role === 'ADMIN') return next();
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Forbidden'));
    }
    return next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRoles };
