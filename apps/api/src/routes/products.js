const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

function serializeProduct(product) {
  return {
    ...product,
    price: Number(product.price),
    compareAtPrice:
      product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    variants: (product.variants || []).map((variant) => ({
      ...variant,
      price: Number(variant.price),
    })),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { isActive: true };
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ price: 'asc' }, { name: 'asc' }],
        },
      },
    });

    res.json(products.map(serializeProduct));
  }),
);

module.exports = router;
