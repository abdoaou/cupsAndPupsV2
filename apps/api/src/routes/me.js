const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      ...req.user,
      loyaltyAccount: { pointsBalance: 0, lifetimePoints: 0 },
      _count: { pets: 0, orders: 0 },
    });
  }),
);

router.get(
  '/appointments',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user.email) {
      res.json([]);
      return;
    }

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT id, customer_name, pet_name, pet_species, service_label,
             start_at, end_at, status, total_price, customer_notes
      FROM bookings
      WHERE lower(COALESCE(customer_email, '')) = lower($1)
      ORDER BY start_at DESC
      LIMIT 50
      `,
      req.user.email,
    );

    res.json(
      rows.map((row) => ({
        id: String(row.id),
        status: String(row.status || '').toUpperCase(),
        startTime: row.start_at,
        endTime: row.end_at,
        totalPrice: row.total_price == null ? null : Number(row.total_price),
        notes: row.customer_notes,
        pet: { name: row.pet_name, species: row.pet_species },
        services: row.service_label ? [row.service_label] : [],
      })),
    );
  }),
);

router.patch(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  }),
);

module.exports = router;
