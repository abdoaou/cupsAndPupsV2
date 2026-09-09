const express = require('express');
const { prisma } = require('../lib/prisma');
const { HttpError, asyncHandler } = require('../lib/http');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { createBookingFromPayload } = require('../lib/create-booking');

const router = express.Router();

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function serializeProduct(product) {
  return {
    ...product,
    price: Number(product.price),
    compareAtPrice:
      product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
        }))
      : undefined,
  };
}

function serializeMenuItem(item) {
  return {
    ...item,
    price: Number(item.price),
    variants: Array.isArray(item.variants)
      ? item.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
        }))
      : undefined,
  };
}

async function defaultLocationId(explicit) {
  if (explicit) return explicit;
  const location = await prisma.location.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!location) throw new HttpError(404, 'No active location found');
  return location.id;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get(
  '/dashboard',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (_req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const weekAhead = new Date(startOfDay);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const startOfWeek = new Date(startOfDay);
    const day = startOfWeek.getDay(); // 0 Sun
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const bookingAmountWhere = (from, to) => ({
      startTime: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    });

    const [
      appointmentsToday,
      appointmentsUpcoming,
      activeProducts,
      revenueAgg,
      statusGroups,
      recentAppointments,
      activeProductRows,
      weekBookingAgg,
      monthBookingAgg,
      pendingCount,
      confirmedCount,
      statusAllGroups,
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          startTime: { gte: startOfDay, lte: endOfDay },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.appointment.count({
        where: {
          startTime: { gte: startOfDay, lt: weekAhead },
          status: {
            in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
          },
        },
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.transaction.aggregate({
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { startTime: { gte: startOfDay, lte: endOfDay } },
        _count: { _all: true },
      }),
      prisma.appointment.findMany({
        where: {
          startTime: { gte: startOfDay },
          status: { not: 'CANCELLED' },
        },
        orderBy: { startTime: 'asc' },
        take: 12,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          pet: { select: { name: true, species: true, breed: true } },
          services: { include: { service: { select: { name: true } } } },
          staff: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          lowStockThreshold: true,
        },
        orderBy: { stockQty: 'asc' },
      }),
      prisma.appointment.aggregate({
        where: bookingAmountWhere(startOfWeek, endOfWeek),
        _sum: { priceCharged: true },
        _count: { _all: true },
      }),
      prisma.appointment.aggregate({
        where: bookingAmountWhere(startOfMonth, endOfMonth),
        _sum: { priceCharged: true },
        _count: { _all: true },
      }),
      prisma.appointment.count({ where: { status: 'PENDING' } }),
      prisma.appointment.count({ where: { status: 'CONFIRMED' } }),
      prisma.appointment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const lowStockProducts = activeProductRows
      .filter((p) => p.stockQty <= p.lowStockThreshold)
      .slice(0, 8);

    res.json({
      kpis: {
        appointmentsToday,
        appointmentsUpcoming,
        lowStockCount: activeProductRows.filter(
          (p) => p.stockQty <= p.lowStockThreshold,
        ).length,
        activeProducts,
        revenueToday: Number(revenueAgg._sum.amount ?? 0),
        bookingAmountWeek: Number(weekBookingAgg._sum.priceCharged ?? 0),
        bookingAmountMonth: Number(monthBookingAgg._sum.priceCharged ?? 0),
        bookingsThisWeek: weekBookingAgg._count._all,
        bookingsThisMonth: monthBookingAgg._count._all,
        pendingCount,
        confirmedCount,
      },
      appointmentsByStatus: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      appointmentsByStatusAll: statusAllGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      upcomingAppointments: recentAppointments.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        priceCharged: a.priceCharged == null ? null : Number(a.priceCharged),
        customer: a.customer,
        pet: a.pet,
        services: a.services.map((s) => s.service.name),
        staff: a.staff
          ? `${a.staff.user.firstName} ${a.staff.user.lastName}`
          : null,
      })),
      lowStockProducts,
    });
  }),
);

const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

const MENU_CATEGORIES = [
  'COFFEE',
  'FOOD',
  'PET_TREATS',
  'BEVERAGES',
  'SPECIALS',
];

const PRODUCT_CATEGORIES = [
  'FOOD',
  'TREATS',
  'TOYS',
  'ACCESSORIES',
  'HEALTH',
  'OTHER',
];

function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant) => ({
      id: variant.id || undefined,
      name: String(variant.name || '').trim(),
      sku:
        variant.sku === undefined ? undefined : String(variant.sku || '').trim() || null,
      price:
        variant.price === undefined || variant.price === null || variant.price === ''
          ? null
          : Number(variant.price),
      stockQty:
        variant.stockQty === undefined || variant.stockQty === null || variant.stockQty === ''
          ? 0
          : Number(variant.stockQty),
      sortOrder:
        variant.sortOrder === undefined || variant.sortOrder === null || variant.sortOrder === ''
          ? 0
          : Number(variant.sortOrder),
      isActive: variant.isActive !== false,
    }))
    .filter((variant) => variant.name && variant.price != null);
}

function normalizeMenuVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant, index) => ({
      id: variant.id || undefined,
      name: String(variant.name || '').trim(),
      price:
        variant.price === undefined || variant.price === null || variant.price === ''
          ? null
          : Number(variant.price),
      sortOrder:
        variant.sortOrder === undefined || variant.sortOrder === null || variant.sortOrder === ''
          ? index
          : Number(variant.sortOrder),
      isActive: variant.isActive !== false,
    }))
    .filter((variant) => variant.name && variant.price != null);
}

function mapAppointment(a) {
  return {
    id: a.id,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    notes: a.notes,
    priceCharged: a.priceCharged == null ? null : Number(a.priceCharged),
    customer: a.customer,
    pet: a.pet,
    services: a.services.map((s) => s.service.name),
    staff: a.staff
      ? `${a.staff.user.firstName} ${a.staff.user.lastName}`
      : null,
  };
}

const appointmentInclude = {
  customer: {
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  pet: { select: { name: true, species: true, breed: true } },
  services: { include: { service: { select: { name: true } } } },
  staff: {
    include: { user: { select: { firstName: true, lastName: true } } },
  },
};

router.get(
  '/categories',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY', 'BARISTA'),
  asyncHandler(async (_req, res) => {
    const [menuUsed, productUsed] = await Promise.all([
      prisma.menuItem.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
      prisma.product.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    const menuFromDb = menuUsed.map((r) => r.category);
    const productFromDb = productUsed.map((r) => r.category);

    res.json({
      menu: [...new Set([...MENU_CATEGORIES, ...menuFromDb])],
      products: [...new Set([...PRODUCT_CATEGORIES, ...productFromDb])],
      menuInUse: menuFromDb,
      productsInUse: productFromDb,
    });
  }),
);

router.get(
  '/appointments',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.from || req.query.to) {
      where.startTime = {};
      if (req.query.from) where.startTime.gte = new Date(String(req.query.from));
      if (req.query.to) where.startTime.lte = new Date(String(req.query.to));
    }
    if (req.query.status) where.status = String(req.query.status);

    const sort = String(req.query.sort || 'latest').toLowerCase();
    const orderBy =
      sort === 'oldest' || sort === 'asc'
        ? { startTime: 'asc' }
        : { startTime: 'desc' };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy,
      take: 100,
      include: appointmentInclude,
    });

    res.json(appointments.map(mapAppointment));
  }),
);

router.patch(
  '/appointments/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const body = req.body || {};
    const data = {};

    if (body.status != null) {
      if (!APPOINTMENT_STATUSES.includes(body.status)) {
        throw new HttpError(400, 'Invalid status');
      }
      data.status = body.status;
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.priceCharged !== undefined) {
      data.priceCharged =
        body.priceCharged == null ? null : Number(body.priceCharged);
    }
    if (body.startTime) {
      const start = new Date(body.startTime);
      if (Number.isNaN(start.getTime())) {
        throw new HttpError(400, 'Invalid start time');
      }
      data.startTime = start;
      if (body.endTime) {
        const end = new Date(body.endTime);
        if (Number.isNaN(end.getTime()) || end <= start) {
          throw new HttpError(400, 'Invalid end time');
        }
        data.endTime = end;
      } else if (existing.endTime && existing.startTime) {
        const duration =
          existing.endTime.getTime() - existing.startTime.getTime();
        data.endTime = new Date(start.getTime() + duration);
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data,
      include: appointmentInclude,
    });

    res.json(mapAppointment(appointment));
  }),
);

router.post(
  '/appointments',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const {
      customerName,
      petName,
      phone,
      startTime: startRaw,
      petSize,
      serviceType,
      addNailCutting,
      notes,
      status,
    } = body;

    if (!customerName || String(customerName).trim().length < 2) {
      throw new HttpError(400, 'Name is required');
    }
    if (!petName || !String(petName).trim()) {
      throw new HttpError(400, 'Pet name is required');
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(String(phone || ''))) {
      throw new HttpError(400, 'phone must be a valid phone number');
    }

    // Reuse public booking catalog via require of shared map
    const appointment = await createBookingFromPayload({
      customerName,
      petName,
      phone,
      startTime: startRaw,
      petSize,
      serviceType,
      addNailCutting,
      notes,
      status: APPOINTMENT_STATUSES.includes(status) ? status : 'CONFIRMED',
      allowPast: true,
      sourceNote: 'Admin booking',
    });

    res.status(201).json(appointment);
  }),
);

// ─── Products ────────────────────────────────────────────────────────────────

router.get(
  '/products',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.includeInactive !== 'true' && req.query.includeInactive !== '1') {
      where.isActive = true;
    }
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        variants: {
          where: req.query.includeInactive === 'true' || req.query.includeInactive === '1'
            ? undefined
            : { isActive: true },
          orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    res.json(products.map(serializeProduct));
  }),
);

router.get(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        variants: {
          orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(serializeProduct(product));
  }),
);

router.post(
  '/products',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name?.trim() || body.price == null || !body.category) {
      throw new HttpError(400, 'name, category, and price are required');
    }

    const locationId = await defaultLocationId(body.locationId);
    const variants = normalizeVariants(body.variants);
    try {
      const product = await prisma.product.create({
        data: {
          locationId,
          name: body.name.trim(),
          slug: body.slug?.trim() || slugify(body.name),
          description: body.description,
          category: body.category,
          brand: body.brand,
          petType: body.petType,
          sku: body.sku?.trim() || null,
          price: Number(body.price),
          compareAtPrice: body.compareAtPrice,
          stockQty: body.stockQty ?? 0,
          lowStockThreshold: body.lowStockThreshold ?? 5,
          imageUrl: body.imageUrl,
          isActive: body.isActive ?? true,
          isFeatured: body.isFeatured ?? false,
          variants: variants.length
            ? {
                create: variants.map((variant) => ({
                  name: variant.name,
                  sku: variant.sku,
                  price: variant.price,
                  stockQty: variant.stockQty,
                  isActive: variant.isActive,
                })),
              }
            : undefined,
        },
        include: {
          variants: {
            orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
          },
        },
      });
      res.status(201).json(serializeProduct(product));
    } catch (error) {
      if (error.code === 'P2002') {
        throw new HttpError(409, 'Product slug or SKU already exists');
      }
      throw error;
    }
  }),
);

router.patch(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });
    if (!existing) throw new HttpError(404, 'Product not found');

    const body = req.body || {};
    const variants = normalizeVariants(body.variants);
    try {
      const product = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: req.params.id },
          data: {
            name: body.name?.trim(),
            slug: body.slug?.trim(),
            description: body.description,
            category: body.category,
            brand: body.brand,
            petType: body.petType,
            sku: body.sku === undefined ? undefined : body.sku.trim() || null,
            price: body.price == null ? undefined : Number(body.price),
            compareAtPrice: body.compareAtPrice,
            stockQty: body.stockQty,
            lowStockThreshold: body.lowStockThreshold,
            imageUrl: body.imageUrl,
            isActive: body.isActive,
            isFeatured: body.isFeatured,
          },
        });

        if (Array.isArray(body.variants)) {
          const keepIds = variants.filter((variant) => variant.id).map((variant) => variant.id);
          await tx.productVariant.updateMany({
            where: { productId: req.params.id, id: { notIn: keepIds } },
            data: { isActive: false },
          });

          for (const variant of variants) {
            if (variant.id) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: {
                  name: variant.name,
                  sku: variant.sku,
                  price: variant.price,
                  stockQty: variant.stockQty,
                  isActive: variant.isActive,
                },
              });
            } else {
              await tx.productVariant.create({
                data: {
                  productId: req.params.id,
                  name: variant.name,
                  sku: variant.sku,
                  price: variant.price,
                  stockQty: variant.stockQty,
                  isActive: variant.isActive,
                },
              });
            }
          }
        }

        return tx.product.findUnique({
          where: { id: req.params.id },
          include: {
            variants: {
              orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
            },
          },
        });
      });
      res.json(serializeProduct(product));
    } catch (error) {
      if (error.code === 'P2002') {
        throw new HttpError(409, 'Product slug or SKU already exists');
      }
      throw error;
    }
  }),
);

router.delete(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, 'Product not found');
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(serializeProduct(product));
  }),
);

// ─── Café menu ───────────────────────────────────────────────────────────────

router.get(
  '/menu',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const where = {};
    if (
      req.query.includeUnavailable !== 'true' &&
      req.query.includeUnavailable !== '1'
    ) {
      where.isAvailable = true;
    }
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        variants: {
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    res.json(items.map(serializeMenuItem));
  }),
);

router.get(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: {
        variants: {
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!item) throw new HttpError(404, 'Menu item not found');
    res.json(serializeMenuItem(item));
  }),
);

router.post(
  '/menu',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name?.trim() || body.price == null || !body.category) {
      throw new HttpError(400, 'name, category, and price are required');
    }
    const locationId = await defaultLocationId(body.locationId);
    const variants = normalizeMenuVariants(body.variants);
    const item = await prisma.menuItem.create({
      data: {
        locationId,
        name: body.name.trim(),
        description: body.description,
        category: body.category,
        price: Number(body.price),
        imageUrl: body.imageUrl,
        isPetFriendly: body.isPetFriendly ?? false,
        isAvailable: body.isAvailable ?? true,
        isDailySpecial: body.isDailySpecial ?? false,
        sortOrder: body.sortOrder ?? 0,
        variants: variants.length
          ? {
              create: variants.map((variant) => ({
                name: variant.name,
                price: variant.price,
                sortOrder: variant.sortOrder,
                isActive: variant.isActive,
              })),
            }
          : undefined,
      },
      include: {
        variants: {
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    res.status(201).json(serializeMenuItem(item));
  }),
);

router.patch(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });
    if (!existing) throw new HttpError(404, 'Menu item not found');

    const body = req.body || {};
    const variants = normalizeMenuVariants(body.variants);

    const item = await prisma.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id: req.params.id },
        data: {
          name: body.name?.trim(),
          description: body.description,
          category: body.category,
          price: body.price == null ? undefined : Number(body.price),
          imageUrl: body.imageUrl,
          isPetFriendly: body.isPetFriendly,
          isAvailable: body.isAvailable,
          isDailySpecial: body.isDailySpecial,
          sortOrder: body.sortOrder,
        },
      });

      if (Array.isArray(body.variants)) {
        const keepIds = variants.filter((variant) => variant.id).map((variant) => variant.id);
        await tx.menuItemVariant.updateMany({
          where: { menuItemId: req.params.id, id: { notIn: keepIds } },
          data: { isActive: false },
        });

        for (const variant of variants) {
          if (variant.id) {
            await tx.menuItemVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                price: variant.price,
                sortOrder: variant.sortOrder,
                isActive: variant.isActive,
              },
            });
          } else {
            await tx.menuItemVariant.create({
              data: {
                menuItemId: req.params.id,
                name: variant.name,
                price: variant.price,
                sortOrder: variant.sortOrder,
                isActive: variant.isActive,
              },
            });
          }
        }
      }

      return tx.menuItem.findUnique({
        where: { id: req.params.id },
        include: {
          variants: {
            orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
          },
        },
      });
    });

    res.json(serializeMenuItem(item));
  }),
);

router.delete(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, 'Menu item not found');
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: { isAvailable: false },
      include: {
        variants: {
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
        },
      },
    });
    res.json(serializeMenuItem(item));
  }),
);

module.exports = router;
