const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const { errorHandler } = require('./lib/http');
const { prisma } = require('./lib/prisma');

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

app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cups-and-pups-api',
    runtime: 'node-express',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1', petsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(errorHandler);

async function start() {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(
      `Cups & Pups API (Express) listening on http://localhost:${config.port}/api/v1`,
    );
  });
}

start();
