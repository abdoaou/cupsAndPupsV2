const { app } = require('./app');
const { config } = require('./config');
const { prisma } = require('./lib/prisma');

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
