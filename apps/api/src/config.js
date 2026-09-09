const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Local API .env wins for development (e.g. localhost Postgres)
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  override: true,
});

const config = {
  port: Number(process.env.API_PORT || process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '*',
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    'dev-access-secret-change-me',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    'dev-refresh-secret-change-me',
  jwtAccessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};

module.exports = { config };
