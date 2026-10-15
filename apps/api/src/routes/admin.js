const express = require('express');
const { HttpError, asyncHandler } = require('../lib/http');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { createBookingFromPayload } = require('../lib/create-booking');
const {
  listProducts,
  getProduct,
  listCategoryNames,
  createProduct,
  updateProduct,
  deactivateProduct,
  listBookings,
  updateBookingStatus,
  dashboardSnapshot,
} = require('../lib/live-store');

const router = express.Router();

const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant, index) => ({
      id: variant.id || undefined,
      name: String(variant.name || '').trim(),
      sku:
        variant.sku === undefined
          ? undefined
          : String(variant.sku || '').trim() || null,
      price:
        variant.price === undefined || variant.price === null || variant.price === ''
          ? null
          : Number(variant.price),
      stockQty:
        variant.stockQty === undefined ||
        variant.stockQty === null ||
        variant.stockQty === ''
          ? 0
          : Number(variant.stockQty),
      sortOrder:
        variant.sortOrder === undefined ||
        variant.sortOrder === null ||
        variant.sortOrder === ''
          ? index
          : Number(variant.sortOrder),
      isActive: variant.isActive !== false,
    }))
    .filter((variant) => variant.name && variant.price != null);
}

function dayRange() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const weekAhead = new Date(startOfDay);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const startOfWeek = new Date(startOfDay);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const endOfMonth = new Date(
    startOfDay.getFullYear(),
    startOfDay.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { startOfDay, endOfDay, weekAhead, startOfWeek, endOfWeek, startOfMonth, endOfMonth };
}

router.get(
  '/dashboard',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (_req, res) => {
    res.json(await dashboardSnapshot(dayRange()));
  }),
);

router.get(
  '/categories',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY', 'BARISTA'),
  asyncHandler(async (_req, res) => {
    const names = await listCategoryNames();
    res.json({
      menu: names,
      products: names,
      menuInUse: names,
      productsInUse: names,
    });
  }),
);

router.get(
  '/appointments',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const rows = await listBookings({
      status: req.query.status ? String(req.query.status) : '',
      sort: req.query.sort ? String(req.query.sort) : 'latest',
    });
    res.json(rows);
  }),
);

router.patch(
  '/appointments/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!APPOINTMENT_STATUSES.includes(status)) {
      throw new HttpError(400, 'Invalid status');
    }
    const booking = await updateBookingStatus(req.params.id, status);
    if (!booking) throw new HttpError(404, 'Appointment not found');
    res.json(booking);
  }),
);

router.post(
  '/appointments',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customerName || String(body.customerName).trim().length < 2) {
      throw new HttpError(400, 'Name is required');
    }
    if (!body.petName || !String(body.petName).trim()) {
      throw new HttpError(400, 'Pet name is required');
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(String(body.phone || ''))) {
      throw new HttpError(400, 'phone must be a valid phone number');
    }

    const appointment = await createBookingFromPayload({
      customerName: body.customerName,
      petName: body.petName,
      phone: body.phone,
      startTime: body.startTime,
      petSize: body.petSize,
      serviceType: body.serviceType,
      addNailCutting: body.addNailCutting,
      notes: body.notes,
      status: APPOINTMENT_STATUSES.includes(body.status) ? body.status : 'CONFIRMED',
      allowPast: true,
      sourceNote: 'Admin booking',
    });

    res.status(201).json(appointment);
  }),
);

router.get(
  '/products',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const includeInactive =
      req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const products = await listProducts({
      includeInactive,
      category: req.query.category ? String(req.query.category) : '',
      search: req.query.search ? String(req.query.search) : '',
    });
    res.json(products);
  }),
);

router.get(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const product = await getProduct(req.params.id);
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
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
    const product = await createProduct(body, normalizeVariants(body.variants));
    res.status(201).json(product);
  }),
);

router.patch(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const product = await updateProduct(
      req.params.id,
      body,
      Array.isArray(body.variants) ? normalizeVariants(body.variants) : undefined,
    );
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
  }),
);

router.delete(
  '/products/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'INVENTORY'),
  asyncHandler(async (req, res) => {
    const product = await deactivateProduct(req.params.id);
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
  }),
);

router.get(
  '/menu',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const includeInactive =
      req.query.includeUnavailable === 'true' || req.query.includeUnavailable === '1';
    const items = await listProducts({
      includeInactive,
      category: req.query.category ? String(req.query.category) : '',
      search: req.query.search ? String(req.query.search) : '',
    });
    res.json(items);
  }),
);

router.get(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const item = await getProduct(req.params.id);
    if (!item) throw new HttpError(404, 'Menu item not found');
    res.json(item);
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
    const item = await createProduct(body, normalizeVariants(body.variants));
    res.status(201).json(item);
  }),
);

router.patch(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const item = await updateProduct(
      req.params.id,
      body,
      Array.isArray(body.variants) ? normalizeVariants(body.variants) : undefined,
    );
    if (!item) throw new HttpError(404, 'Menu item not found');
    res.json(item);
  }),
);

router.delete(
  '/menu/:id',
  requireAuth,
  requireRoles('ADMIN', 'MANAGER', 'BARISTA'),
  asyncHandler(async (req, res) => {
    const item = await deactivateProduct(req.params.id);
    if (!item) throw new HttpError(404, 'Menu item not found');
    res.json(item);
  }),
);

module.exports = router;
