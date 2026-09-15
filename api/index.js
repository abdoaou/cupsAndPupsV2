const { app } = require('../apps/api/src/app');

// Vercel Node serverless entry — Express handles /api/v1/* and static pages.
module.exports = app;
