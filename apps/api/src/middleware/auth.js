const { verifyAccessToken } = require('../lib/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { findAdminById, publicAdmin } = require('../lib/live-store');

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
  const admin = await findAdminById(payload.sub);
  if (!admin) {
    throw new HttpError(401, 'User inactive or not found');
  }

  req.user = publicAdmin(admin);
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
