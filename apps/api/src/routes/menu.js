const express = require('express');
const { prisma } = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

/** Map legacy category ids → café menu group keys used by the UI. */
const CATEGORY_BY_ID = {
  1: 'COFFEE',
  19: 'BEVERAGES',
  3: 'SPECIALS',
  4: 'FOOD',
  5: 'ADDONS',
};

const CATEGORY_BY_SLUG = {
  'hot-coffee': 'COFFEE',
  'iced-coffee': 'BEVERAGES',
  'signature-drinks': 'SPECIALS',
  desserts: 'FOOD',
  addons: 'ADDONS',
  smoothie: 'BEVERAGES',
};

function menuCategoryKey(categoryId, categorySlug) {
  if (categoryId != null && CATEGORY_BY_ID[categoryId]) {
    return CATEGORY_BY_ID[categoryId];
  }
  if (categorySlug && CATEGORY_BY_SLUG[categorySlug]) {
    return CATEGORY_BY_SLUG[categorySlug];
  }
  return 'SPECIALS';
}

function isPetFriendly(name = '') {
  return /puppy|paw|pawsitive|pet.?friendly/i.test(name);
}

function moneyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Café menu is served from the existing Supabase/Railway `products` table
 * (website-scoped), not Prisma `menu_items`.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const websiteId = Number(
      req.query.website_id || process.env.WEBSITE_ID || 1,
    );
    const categoryFilter = req.query.category
      ? String(req.query.category).toUpperCase()
      : '';

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.short_description,
        p.price,
        p.sale_price,
        p.image,
        p.category_id,
        p.featured,
        c.name AS category_name,
        c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.website_id = $1
        AND p.deleted_at IS NULL
        AND p.status = 'active'
      ORDER BY
        COALESCE(p.category_id, 9999) ASC,
        p.name ASC
      `,
      websiteId,
    );

    const variants = await prisma.$queryRawUnsafe(
      `
      SELECT
        v.id,
        v.product_id,
        v.name,
        v.price,
        v.sale_price,
        v.sort_order,
        v.status
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id
      WHERE p.website_id = $1
        AND p.deleted_at IS NULL
        AND p.status = 'active'
        AND v.deleted_at IS NULL
        AND v.status = 'active'
      ORDER BY v.product_id ASC, v.sort_order ASC, v.price ASC, v.name ASC
      `,
      websiteId,
    );

    const variantsByProduct = new Map();
    for (const variant of variants) {
      const list = variantsByProduct.get(variant.product_id) || [];
      list.push({
        id: String(variant.id),
        name: variant.name,
        price: moneyNumber(variant.sale_price ?? variant.price),
        isActive: true,
        sortOrder: Number(variant.sort_order || 0),
      });
      variantsByProduct.set(variant.product_id, list);
    }

    let items = rows.map((row) => {
      const category = menuCategoryKey(row.category_id, row.category_slug);
      const basePrice = moneyNumber(row.sale_price ?? row.price);
      const itemVariants = variantsByProduct.get(row.id) || [];
      const price =
        itemVariants.length > 0
          ? Math.min(...itemVariants.map((v) => v.price))
          : basePrice;

      return {
        id: String(row.id),
        name: row.name,
        description: row.description || row.short_description || null,
        category,
        categoryLabel: row.category_name || category,
        price,
        imageUrl: row.image || null,
        isPetFriendly: isPetFriendly(row.name),
        isAvailable: true,
        isDailySpecial: Boolean(row.featured),
        variants: itemVariants,
      };
    });

    if (categoryFilter) {
      items = items.filter((item) => item.category === categoryFilter);
    }

    res.json(items);
  }),
);

module.exports = router;
