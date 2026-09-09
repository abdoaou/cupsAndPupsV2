const express = require('express');
const { asyncHandler } = require('../lib/http');
const auth = require('../lib/auth');

const router = express.Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const result = await auth.register(req.body || {});
    res.status(201).json(result);
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const result = await auth.login(req.body || {});
    res.json(result);
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await auth.refresh(req.body?.refreshToken);
    res.json(result);
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const result = await auth.logout(req.body?.refreshToken);
    res.json(result);
  }),
);

module.exports = router;
