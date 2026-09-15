const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

function serializeMenuItem(item) {
  return {
    ...item,
    price: Number(item.price),
    variants: Array.isArray(item.variants)
      ? item.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
        }))
      : [],
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { isAvailable: true };
    if (req.query.category) where.category = String(req.query.category);

    try {
      const items = await prisma.menuItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
          },
        },
      });
      res.json(items.map(serializeMenuItem));
    } catch (err) {
      // Older DBs may not have menu_item_variants yet.
      if (String(err.message || '').includes('menu_item_variants')) {
        const items = await prisma.menuItem.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        res.json(items.map((item) => serializeMenuItem({ ...item, variants: [] })));
        return;
      }
      throw err;
    }
  }),
);

module.exports = router;
