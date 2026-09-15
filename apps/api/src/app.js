const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const { errorHandler } = require('./lib/http');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const petsRoutes = require('./routes/pets');
const bookingsRoutes = require('./routes/bookings');
const menuRoutes = require('./routes/menu');
const productsRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', async (_req, res) => {
  const payload = {
    status: 'ok',
    service: 'cups-and-pups-api',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
    timestamp: new Date().toISOString(),
    database: 'unknown',
  };

  try {
    const { prisma } = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    payload.database = 'connected';
  } catch (err) {
    payload.status = 'degraded';
    payload.database = 'error';
    payload.databaseError = err.message;
  }

  res.status(payload.database === 'connected' ? 200 : 503).json(payload);
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1', petsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/admin', adminRoutes);

const publicCandidates = [
  path.join(process.cwd(), 'public'),
  path.join(__dirname, '../../../public'),
  path.join(__dirname, '../../web/public'),
].filter((dir) => fs.existsSync(dir));

const publicDir = publicCandidates[0];

if (publicDir) {
  app.use(express.static(publicDir));

  const pages = ['book', 'menu', 'shop', 'account', 'login', 'register'];
  for (const page of pages) {
    app.get(`/${page}`, (_req, res) => {
      res.sendFile(path.join(publicDir, `${page}.html`));
    });
  }

  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'index.html'));
  });
  app.get('/admin/login', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'login.html'));
  });
  app.get('/admin/products', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'products.html'));
  });
  app.get('/admin/bookings', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'bookings.html'));
  });
  app.get('/admin/menu', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', 'menu.html'));
  });
  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use(errorHandler);

module.exports = { app };
