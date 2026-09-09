const express = require('express');
const { prisma } = require('../lib/prisma');
const { HttpError, asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        loyaltyAccount: {
          select: { pointsBalance: true, lifetimePoints: true },
        },
        _count: { select: { pets: true, orders: true } },
      },
    });
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  }),
);

router.get(
  '/appointments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const appointments = await prisma.appointment.findMany({
      where: { customerId: req.user.id },
      orderBy: { startTime: 'asc' },
      take: 50,
      include: {
        pet: { select: { id: true, name: true, species: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    });

    res.json(
      appointments.map((a) => ({
        id: a.id,
        status: a.status,
        startTime: a.startTime,
        endTime: a.endTime,
        totalPrice: a.priceCharged == null ? null : Number(a.priceCharged),
        notes: a.notes,
        pet: a.pet,
        services: a.services.map((s) => s.service.name),
      })),
    );
  }),
);

router.patch(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, avatarUrl } = req.body || {};
    if (phone) {
      const taken = await prisma.user.findFirst({
        where: { phone, NOT: { id: req.user.id } },
      });
      if (taken) throw new HttpError(409, 'Phone number already in use');
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        phone,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    res.json(user);
  }),
);

module.exports = router;
