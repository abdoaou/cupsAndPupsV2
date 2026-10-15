const { prisma } = require('./prisma');
const { HttpError } = require('./http');

const LOW_STOCK = 0;

const CATEGORY_ALIASES = {
  COFFEE: 'Hot Coffee',
  BEVERAGES: 'Iced Coffee',
  FOOD: 'Desserts',
  SPECIALS: 'Signature Drinks',
  PET_TREATS: 'Add-ons',
  ADDONS: 'Add-ons',
  TREATS: 'Add-ons',
  TOYS: 'Add-ons',
  ACCESSORIES: 'Add-ons',
  HEALTH: 'Add-ons',
  OTHER: 'Add-ons',
};

function websiteId() {
  return Number(process.env.WEBSITE_ID || 1);
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isPetFriendly(name = '') {
  return /puppy|paw|pawsitive|pet.?friendly/i.test(name);
}

function mapVariant(row) {
  return {
    id: String(row.id),
    name: row.name,
    sku: row.sku || null,
    price: money(row.sale_price ?? row.price),
    stockQty: Number(row.stock || 0),
    sortOrder: Number(row.sort_order || 0),
    isActive: row.status === 'active' && !row.deleted_at,
  };
}

function mapProduct(row, variants = []) {
  const visible = variants.filter((variant) => !variant.deleted_at);
  const active = row.status === 'active' && !row.deleted_at;
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description || row.short_description || null,
    category: row.category_name || 'Uncategorized',
    brand: null,
    petType: null,
    sku: row.sku || null,
    price: money(row.sale_price ?? row.price),
    compareAtPrice: row.sale_price == null ? null : money(row.price),
    stockQty: Number(row.stock || 0),
    lowStockThreshold: LOW_STOCK,
    imageUrl: row.image || null,
    isActive: active,
    isFeatured: Boolean(row.featured),
    isAvailable: active,
    isPetFriendly: isPetFriendly(row.name),
    isDailySpecial: Boolean(row.featured),
    sortOrder: 0,
    variants: visible.map(mapVariant),
  };
}

async function loadVariants(productIds) {
  if (!productIds.length) return new Map();
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, product_id, name, sku, price, sale_price, stock, sort_order, status, deleted_at
    FROM product_variants
    WHERE product_id = ANY($1::int[])
      AND deleted_at IS NULL
    ORDER BY product_id ASC, sort_order ASC, price ASC, name ASC
    `,
    productIds,
  );
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.product_id) || [];
    list.push(row);
    grouped.set(row.product_id, list);
  }
  return grouped;
}

async function listProducts({
  includeInactive = false,
  category = '',
  search = '',
} = {}) {
  const params = [websiteId()];
  const where = ['p.website_id = $1', 'p.deleted_at IS NULL'];

  if (!includeInactive) {
    where.push(`p.status = 'active'`);
  }
  if (category) {
    params.push(String(category));
    where.push(`lower(c.name) = lower($${params.length})`);
  }
  if (search) {
    params.push(`%${String(search)}%`);
    where.push(
      `(p.name ILIKE $${params.length} OR COALESCE(p.sku, '') ILIKE $${params.length})`,
    );
  }

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      p.id, p.name, p.slug, p.description, p.short_description, p.price, p.sale_price,
      p.stock, p.sku, p.image, p.status, p.featured, p.deleted_at, p.category_id,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE lower(trim(p.name))
        WHEN 'espresso' THEN 0
        WHEN 'double espresso' THEN 1
        ELSE 2
      END,
      p.name ASC
    `,
    ...params,
  );

  const variants = await loadVariants(rows.map((row) => row.id));
  return rows.map((row) => mapProduct(row, variants.get(row.id) || []));
}

async function getProduct(id) {
  const productId = Number(id);
  if (!Number.isInteger(productId)) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      p.id, p.name, p.slug, p.description, p.short_description, p.price, p.sale_price,
      p.stock, p.sku, p.image, p.status, p.featured, p.deleted_at, p.category_id,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1 AND p.website_id = $2 AND p.deleted_at IS NULL
    LIMIT 1
    `,
    productId,
    websiteId(),
  );
  if (!rows.length) return null;
  const variants = await loadVariants([productId]);
  return mapProduct(rows[0], variants.get(productId) || []);
}

async function categoryIdFor(name) {
  const label = CATEGORY_ALIASES[String(name || '').toUpperCase()] || String(name || '');
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, name
    FROM categories
    WHERE deleted_at IS NULL
      AND (lower(name) = lower($1) OR lower(slug) = lower($1))
    LIMIT 1
    `,
    label,
  );
  if (!rows.length) {
    throw new HttpError(400, 'Unknown category');
  }
  return rows[0];
}

async function listCategoryNames() {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT name
    FROM categories
    WHERE deleted_at IS NULL AND status = 'active'
    ORDER BY id ASC
    `,
  );
  return rows.map((row) => row.name);
}

async function uniqueSlug(base, ignoreId) {
  let slug = slugify(base) || 'item';
  let n = 1;
  for (;;) {
    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT id FROM products
      WHERE website_id = $1 AND slug = $2 AND ($3::int IS NULL OR id <> $3)
      LIMIT 1
      `,
      websiteId(),
      slug,
      ignoreId == null ? null : Number(ignoreId),
    );
    if (!rows.length) return slug;
    n += 1;
    slug = `${slugify(base) || 'item'}-${n}`;
  }
}

async function replaceVariants(productId, variants) {
  const keep = [];
  for (const [index, variant] of variants.entries()) {
    const status = variant.isActive === false ? 'inactive' : 'active';
    if (variant.id && Number.isInteger(Number(variant.id))) {
      const id = Number(variant.id);
      await prisma.$executeRawUnsafe(
        `
        UPDATE product_variants
        SET name = $1, sku = $2, price = $3, stock = $4, sort_order = $5,
            status = $6, updated_at = now()
        WHERE id = $7 AND product_id = $8 AND deleted_at IS NULL
        `,
        variant.name,
        variant.sku || null,
        variant.price,
        Number(variant.stockQty || 0),
        Number(variant.sortOrder ?? index),
        status,
        id,
        productId,
      );
      keep.push(id);
    } else {
      const inserted = await prisma.$queryRawUnsafe(
        `
        INSERT INTO product_variants
          (product_id, name, sku, price, stock, sort_order, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
        RETURNING id
        `,
        productId,
        variant.name,
        variant.sku || null,
        variant.price,
        Number(variant.stockQty || 0),
        Number(variant.sortOrder ?? index),
        status,
      );
      keep.push(inserted[0].id);
    }
  }

  if (keep.length) {
    await prisma.$executeRawUnsafe(
      `
      UPDATE product_variants
      SET deleted_at = now(), status = 'inactive', updated_at = now()
      WHERE product_id = $1 AND deleted_at IS NULL AND NOT (id = ANY($2::int[]))
      `,
      productId,
      keep,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
      UPDATE product_variants
      SET deleted_at = now(), status = 'inactive', updated_at = now()
      WHERE product_id = $1 AND deleted_at IS NULL
      `,
      productId,
    );
  }
}

async function createProduct(body, variants) {
  const category = await categoryIdFor(body.category);
  const slug = await uniqueSlug(body.slug || body.name);
  const rows = await prisma.$queryRawUnsafe(
    `
    INSERT INTO products (
      website_id, category_id, name, slug, description, price, stock, sku,
      status, featured, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
    RETURNING id
    `,
    websiteId(),
    category.id,
    String(body.name).trim(),
    slug,
    body.description || null,
    Number(body.price),
    Number(body.stockQty || 0),
    body.sku ? String(body.sku).trim() : null,
    body.isActive === false || body.isAvailable === false ? 'inactive' : 'active',
    Boolean(body.isFeatured || body.isDailySpecial),
  );
  if (variants.length) {
    await replaceVariants(rows[0].id, variants);
  }
  return getProduct(rows[0].id);
}

async function updateProduct(id, body, variants) {
  const existing = await getProduct(id);
  if (!existing) return null;
  const productId = Number(id);
  const sets = ['updated_at = now()'];
  const params = [];

  if (body.name != null) {
    params.push(String(body.name).trim());
    sets.push(`name = $${params.length}`);
  }
  if (body.slug != null || body.name != null) {
    const slug = await uniqueSlug(body.slug || body.name || existing.name, productId);
    params.push(slug);
    sets.push(`slug = $${params.length}`);
  }
  if (body.description !== undefined) {
    params.push(body.description || null);
    sets.push(`description = $${params.length}`);
  }
  if (body.price != null) {
    params.push(Number(body.price));
    sets.push(`price = $${params.length}`);
  }
  if (body.stockQty != null) {
    params.push(Number(body.stockQty));
    sets.push(`stock = $${params.length}`);
  }
  if (body.sku !== undefined) {
    params.push(body.sku ? String(body.sku).trim() : null);
    sets.push(`sku = $${params.length}`);
  }
  if (body.category) {
    const category = await categoryIdFor(body.category);
    params.push(category.id);
    sets.push(`category_id = $${params.length}`);
  }
  if (body.isActive != null || body.isAvailable != null) {
    const active =
      body.isActive != null ? body.isActive !== false : body.isAvailable !== false;
    params.push(active ? 'active' : 'inactive');
    sets.push(`status = $${params.length}`);
  }
  if (body.isFeatured != null || body.isDailySpecial != null) {
    const featured =
      body.isFeatured != null ? Boolean(body.isFeatured) : Boolean(body.isDailySpecial);
    params.push(featured);
    sets.push(`featured = $${params.length}`);
  }

  params.push(productId, websiteId());
  await prisma.$executeRawUnsafe(
    `
    UPDATE products
    SET ${sets.join(', ')}
    WHERE id = $${params.length - 1} AND website_id = $${params.length} AND deleted_at IS NULL
    `,
    ...params,
  );

  if (Array.isArray(variants)) {
    await replaceVariants(productId, variants);
  }
  return getProduct(productId);
}

async function deactivateProduct(id) {
  const existing = await getProduct(id);
  if (!existing) return null;
  await prisma.$executeRawUnsafe(
    `
    UPDATE products
    SET status = 'inactive', updated_at = now()
    WHERE id = $1 AND website_id = $2 AND deleted_at IS NULL
    `,
    Number(id),
    websiteId(),
  );
  return getProduct(id);
}

function mapBooking(row) {
  const status = String(row.status || '').toUpperCase();
  const name = String(row.customer_name || '').trim();
  const [firstName, ...rest] = name.split(/\s+/);
  return {
    id: String(row.id),
    startTime: row.start_at,
    endTime: row.end_at,
    status,
    notes: row.customer_notes || null,
    priceCharged: row.total_price == null ? null : money(row.total_price),
    totalPrice: row.total_price == null ? null : money(row.total_price),
    customer: {
      firstName: firstName || name,
      lastName: rest.join(' '),
      phone: row.customer_phone || null,
      email: row.customer_email || null,
    },
    pet: {
      name: row.pet_name,
      species: row.pet_species,
      breed: row.pet_breed,
    },
    services: row.service_label ? [row.service_label] : [],
    staff: row.groomer_name || null,
  };
}

async function listBookings({ status, sort } = {}) {
  const params = [];
  const where = ['1 = 1'];
  if (status) {
    params.push(String(status).toLowerCase());
    where.push(`status::text = $${params.length}`);
  }
  const direction = sort === 'oldest' || sort === 'asc' ? 'ASC' : 'DESC';
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, customer_name, customer_phone, customer_email, pet_name, pet_species,
           pet_breed, service_label, groomer_name, start_at, end_at, status,
           total_price, customer_notes
    FROM bookings
    WHERE ${where.join(' AND ')}
    ORDER BY start_at ${direction}
    LIMIT 100
    `,
    ...params,
  );
  return rows.map(mapBooking);
}

async function updateBookingStatus(id, status) {
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
    UPDATE bookings
    SET status = $1::booking_status, updated_at = now()
    WHERE id = $2
    RETURNING id, customer_name, customer_phone, customer_email, pet_name, pet_species,
              pet_breed, service_label, groomer_name, start_at, end_at, status,
              total_price, customer_notes
    `,
    String(status).toLowerCase(),
    bookingId,
  );
  return rows[0] ? mapBooking(rows[0]) : null;
}

async function dashboardSnapshot(ranges) {
  const [counts, upcoming, stock] = await Promise.all([
    prisma.$queryRawUnsafe(
      `
      SELECT
        count(*) FILTER (
          WHERE start_at >= $1 AND start_at <= $2 AND status::text <> 'cancelled'
        )::int AS today,
        count(*) FILTER (
          WHERE start_at >= $1 AND start_at < $3
            AND status::text IN ('pending','confirmed','checked_in','in_progress')
        )::int AS upcoming,
        count(*) FILTER (WHERE status::text = 'pending')::int AS pending,
        count(*) FILTER (WHERE status::text = 'confirmed')::int AS confirmed,
        count(*) FILTER (
          WHERE start_at >= $4 AND start_at <= $5 AND status::text <> 'cancelled'
        )::int AS week_count,
        COALESCE(sum(total_price) FILTER (
          WHERE start_at >= $4 AND start_at <= $5 AND status::text <> 'cancelled'
        ), 0) AS week_total,
        count(*) FILTER (
          WHERE start_at >= $6 AND start_at <= $7 AND status::text <> 'cancelled'
        )::int AS month_count,
        COALESCE(sum(total_price) FILTER (
          WHERE start_at >= $6 AND start_at <= $7 AND status::text <> 'cancelled'
        ), 0) AS month_total,
        COALESCE(sum(total_price) FILTER (
          WHERE start_at >= $1 AND start_at <= $2 AND status::text <> 'cancelled'
        ), 0) AS today_total
      FROM bookings
      `,
      ranges.startOfDay,
      ranges.endOfDay,
      ranges.weekAhead,
      ranges.startOfWeek,
      ranges.endOfWeek,
      ranges.startOfMonth,
      ranges.endOfMonth,
    ),
    prisma.$queryRawUnsafe(
      `
      SELECT id, customer_name, customer_phone, customer_email, pet_name, pet_species,
             pet_breed, service_label, groomer_name, start_at, end_at, status,
             total_price, customer_notes
      FROM bookings
      WHERE start_at >= $1 AND status::text <> 'cancelled'
      ORDER BY start_at ASC
      LIMIT 12
      `,
      ranges.startOfDay,
    ),
    prisma.$queryRawUnsafe(
      `
      SELECT id, name, sku, stock
      FROM products
      WHERE website_id = $1 AND deleted_at IS NULL AND status = 'active'
      ORDER BY stock ASC, name ASC
      `,
      websiteId(),
    ),
  ]);

  const summary = counts[0] || {};
  const lowStockProducts = stock
    .filter((row) => Number(row.stock || 0) <= LOW_STOCK)
    .slice(0, 8)
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      sku: row.sku,
      stockQty: Number(row.stock || 0),
      lowStockThreshold: LOW_STOCK,
    }));

  return {
    kpis: {
      appointmentsToday: Number(summary.today || 0),
      appointmentsUpcoming: Number(summary.upcoming || 0),
      lowStockCount: stock.filter((row) => Number(row.stock || 0) <= LOW_STOCK)
        .length,
      activeProducts: stock.length,
      revenueToday: money(summary.today_total),
      bookingAmountWeek: money(summary.week_total),
      bookingAmountMonth: money(summary.month_total),
      bookingsThisWeek: Number(summary.week_count || 0),
      bookingsThisMonth: Number(summary.month_count || 0),
      pendingCount: Number(summary.pending || 0),
      confirmedCount: Number(summary.confirmed || 0),
    },
    appointmentsByStatus: [],
    appointmentsByStatusAll: [],
    upcomingAppointments: upcoming.map(mapBooking),
    lowStockProducts,
  };
}

async function findAdminByLogin(login) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, username, email, password, created_at
    FROM admins
    WHERE lower(email) = lower($1) OR lower(username) = lower($1)
    LIMIT 1
    `,
    String(login || '').trim(),
  );
  return rows[0] || null;
}

async function findAdminById(id) {
  const adminId = Number(id);
  if (!Number.isInteger(adminId)) return null;
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, username, email, created_at
    FROM admins
    WHERE id = $1
    LIMIT 1
    `,
    adminId,
  );
  return rows[0] || null;
}

function publicAdmin(row) {
  return {
    id: String(row.id),
    email: row.email,
    phone: null,
    firstName: row.username || 'Admin',
    lastName: '',
    role: 'ADMIN',
    avatarUrl: null,
    createdAt: row.created_at,
  };
}

module.exports = {
  LOW_STOCK,
  listProducts,
  getProduct,
  listCategoryNames,
  createProduct,
  updateProduct,
  deactivateProduct,
  listBookings,
  updateBookingStatus,
  dashboardSnapshot,
  findAdminByLogin,
  findAdminById,
  publicAdmin,
};
