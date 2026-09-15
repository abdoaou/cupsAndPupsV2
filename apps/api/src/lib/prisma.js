const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__cupsPrisma ||
  new PrismaClient({
    log: ['error'],
  });

globalForPrisma.__cupsPrisma = prisma;

module.exports = { prisma };
