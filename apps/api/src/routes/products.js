const express = require('express');
const { asyncHandler } = require('../lib/http');
const { listProducts } = require('../lib/live-store');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await listProducts({
      category: req.query.category ? String(req.query.category) : '',
      search: req.query.search ? String(req.query.search) : '',
    });
    res.json(products);
  }),
);

module.exports = router;
