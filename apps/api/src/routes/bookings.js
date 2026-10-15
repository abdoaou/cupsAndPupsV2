const express = require('express');
const { HttpError, asyncHandler } = require('../lib/http');
const { optionalAuth } = require('../middleware/auth');
const {
  catalogList,
  createBookingFromPayload,
  getBusyRangesForDate,
} = require('../lib/create-booking');

const router = express.Router();

router.get('/catalog', (_req, res) => {
  res.json(catalogList());
});

router.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'date is required as YYYY-MM-DD');
    }

    const busy = await getBusyRangesForDate(date);
    res.json({
      date,
      busy,
    });
  }),
);

router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const result = await createBookingFromPayload({
      customerName: body.customerName,
      petName: body.petName,
      phone: body.phone,
      startTime: body.startTime,
      petSize: body.petSize,
      serviceType: body.serviceType,
      addNailCutting: body.addNailCutting,
      notes: body.notes,
      authUserId: req.auth?.sub,
      status: 'PENDING',
      sourceNote: 'Online booking',
    });
    res.status(201).json(result);
  }),
);

module.exports = router;
