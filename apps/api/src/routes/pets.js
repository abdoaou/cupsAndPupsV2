const express = require('express');
const { HttpError, asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/me/pets',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json([]);
  }),
);

router.post(
  '/me/pets',
  requireAuth,
  asyncHandler(async () => {
    throw new HttpError(400, 'Pet profiles are not stored on this site yet.');
  }),
);

router.patch(
  '/pets/:id',
  requireAuth,
  asyncHandler(async () => {
    throw new HttpError(404, 'Pet not found');
  }),
);

router.delete(
  '/pets/:id',
  requireAuth,
  asyncHandler(async () => {
    throw new HttpError(404, 'Pet not found');
  }),
);

module.exports = router;
