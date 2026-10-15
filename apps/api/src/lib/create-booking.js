const { prisma } = require('./prisma');
const { HttpError } = require('./http');

const CATALOG = {
  'small:shower': {
    label: 'Small dog — Shower',
    price: 8,
    durationMinutes: 60,
    species: 'DOG',
    sizeCategory: 'small',
  },
  'small:shower_cutting': {
    label: 'Small dog — Shower + cutting',
    price: 15,
    durationMinutes: 90,
    species: 'DOG',
    sizeCategory: 'small',
  },
  'medium:shower': {
    label: 'Medium dog — Shower',
    price: 10,
    durationMinutes: 60,
    species: 'DOG',
    sizeCategory: 'medium',
  },
  'medium:shower_cutting': {
    label: 'Medium dog — Shower + cutting',
    price: 20,
    durationMinutes: 90,
    species: 'DOG',
    sizeCategory: 'medium',
  },
  'large:shower': {
    label: 'Large dog — Shower',
    price: 15,
    durationMinutes: 60,
    species: 'DOG',
    sizeCategory: 'large',
  },
  'large:shower_cutting': {
    label: 'Large dog — Shower + cutting',
    price: 25,
    durationMinutes: 90,
    species: 'DOG',
    sizeCategory: 'large',
  },
  'cat:shower': {
    label: 'Cat — Shower',
    price: 8,
    durationMinutes: 60,
    species: 'CAT',
    sizeCategory: 'cat',
  },
  'cat:shower_cutting': {
    label: 'Cat — Shower + cutting',
    price: 15,
    durationMinutes: 90,
    species: 'CAT',
    sizeCategory: 'cat',
  },
};

const OPEN_HOUR = 11;
const CLOSE_HOUR = 16;
const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE || 'Asia/Beirut';

function getShopParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
  };
}

function getShopWeekday(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIMEZONE,
    weekday: 'short',
  }).format(date);
}

function assertWithinGroomingHours(startTime, durationMinutes, { skipPastCheck = false } = {}) {
  const start = getShopParts(startTime);
  const endDate = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const end = getShopParts(endDate);

  if (getShopWeekday(startTime) === 'Sun') {
    throw new HttpError(
      400,
      'Grooming is closed on Sundays — coffee shop only. Please choose Mon–Sat.',
    );
  }

  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const openMinutes = OPEN_HOUR * 60;
  const closeMinutes = CLOSE_HOUR * 60;

  if (startMinutes < openMinutes) {
    throw new HttpError(400, 'Grooming opens at 11:00 AM Mon–Sat');
  }
  if (endMinutes > closeMinutes || end.day !== start.day) {
    throw new HttpError(
      400,
      'Bookings must finish by 4:00 PM. Pick an earlier slot.',
    );
  }

  if (!skipPastCheck && startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new HttpError(400, 'Please choose a future time');
  }
}

const BLOCKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
];

function shopDayBounds(dateValue) {
  const [y, m, d] = String(dateValue).split('-').map(Number);
  if (!y || !m || !d) throw new HttpError(400, 'Invalid date');

  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const dayStart = new Date(utcMidnight.getTime() - 14 * 60 * 60 * 1000);
  const dayEnd = new Date(utcMidnight.getTime() + 38 * 60 * 60 * 1000);
  return { dayStart, dayEnd, year: y, month: m, day: d };
}

async function findOverlappingAppointments(startTime, endTime, _locationId, { excludeId } = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT id, start_at, end_at, status::text AS status
    FROM bookings
    WHERE status IN ('pending', 'confirmed', 'checked_in', 'in_progress')
      AND start_at < $1
      AND end_at > $2
      AND ($3::bigint IS NULL OR id <> $3::bigint)
    ORDER BY start_at ASC
    `,
    startTime,
    endTime,
    excludeId == null ? null : Number(excludeId),
  );

  return rows.map((row) => ({
    id: String(row.id),
    startTime: new Date(row.start_at),
    endTime: new Date(row.end_at),
    status: String(row.status || '').toUpperCase(),
  }));
}

async function assertSlotAvailable(startTime, endTime, locationId, { excludeId } = {}) {
  const conflicts = await findOverlappingAppointments(startTime, endTime, locationId, {
    excludeId,
  });
  if (conflicts.length) {
    const first = conflicts[0];
    const from = first.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: SHOP_TIMEZONE,
    });
    const to = first.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: SHOP_TIMEZONE,
    });
    throw new HttpError(
      409,
      `That time overlaps an existing booking (${from} – ${to}). Please choose another slot.`,
    );
  }
}

async function getBusyRangesForDate(dateValue, locationId) {
  const { dayStart, dayEnd, year, month, day } = shopDayBounds(dateValue);

  const rows = await findOverlappingAppointments(dayStart, dayEnd, locationId);

  // Keep only appointments that fall on this shop-local calendar day
  return rows
    .filter((row) => {
      const p = getShopParts(row.startTime);
      return p.year === year && p.month === month && p.day === day;
    })
    .map((row) => ({
      id: row.id,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
      status: row.status,
    }));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Guest' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function catalogList() {
  return Object.entries(CATALOG).map(([key, value]) => {
    const [petSize, serviceType] = key.split(':');
    return { key, petSize, serviceType, ...value };
  });
}

/**
 * @param {object} payload
 * @param {string} [payload.authUserId]
 * @param {boolean} [payload.allowPast]
 * @param {string} [payload.status]
 * @param {string} [payload.sourceNote]
 */
async function createBookingFromPayload(payload) {
  const {
    customerName,
    petName,
    phone,
    startTime: startRaw,
    petSize,
    serviceType,
    addNailCutting,
    notes,
    authUserId,
    allowPast = false,
    status = 'PENDING',
    sourceNote = 'Online booking',
  } = payload;

  if (!customerName || String(customerName).trim().length < 2) {
    throw new HttpError(400, 'Name is required');
  }
  if (!petName || !String(petName).trim()) {
    throw new HttpError(400, 'Pet name is required');
  }
  if (!/^\+?[0-9\s\-()]{7,20}$/.test(String(phone || ''))) {
    throw new HttpError(400, 'phone must be a valid phone number');
  }

  const catalogKey = `${petSize}:${serviceType}`;
  const main = CATALOG[catalogKey];
  if (!main) throw new HttpError(400, 'Unknown service selection');

  const startTime = new Date(startRaw);
  if (Number.isNaN(startTime.getTime())) {
    throw new HttpError(400, 'Invalid start time');
  }

  let totalPrice = main.price;
  let totalDuration = main.durationMinutes;
  const serviceLines = [
    {
      label: main.label,
      price: main.price,
      durationMinutes: main.durationMinutes,
    },
  ];

  if (addNailCutting) {
    totalPrice += 2;
    totalDuration += 15;
    serviceLines.push({
      label: 'Nail cutting',
      price: 2,
      durationMinutes: 15,
    });
  }

  assertWithinGroomingHours(startTime, totalDuration, {
    skipPastCheck: allowPast,
  });

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + totalDuration);

  await assertSlotAvailable(startTime, endTime);

  const normalizedPhone = normalizePhone(phone);
  const { firstName, lastName } = splitName(customerName);
  const dbStatus = String(status || 'PENDING').toLowerCase();
  const species = String(main.species || 'DOG').toLowerCase();
  const addons = addNailCutting
    ? [{ name: 'Nail cutting', price: 2, durationMinutes: 15 }]
    : [];
  const notesText = [sourceNote, notes?.trim() || null].filter(Boolean).join(' · ');
  const source = /admin/i.test(sourceNote) ? 'admin' : 'online';

  const inserted = await prisma.$queryRawUnsafe(
    `
    INSERT INTO bookings (
      customer_name,
      customer_phone,
      pet_name,
      pet_species,
      pet_size,
      service_type,
      service_label,
      duration_minutes,
      price,
      addons_json,
      addons_total,
      total_price,
      start_at,
      end_at,
      status,
      source,
      customer_notes
    ) VALUES (
      $1, $2, $3, $4, $5::pet_size, $6::groom_service_type, $7, $8, $9,
      $10::jsonb, $11, $12, $13, $14, $15::booking_status, $16, $17
    )
    RETURNING id, status::text AS status, start_at, end_at, total_price, customer_notes
    `,
    String(customerName).trim(),
    normalizedPhone,
    String(petName).trim(),
    species === 'cat' ? 'cat' : 'dog',
    main.sizeCategory,
    serviceType,
    serviceLines.map((line) => line.label).join(' + '),
    totalDuration,
    main.price,
    JSON.stringify(addons),
    addNailCutting ? 2 : 0,
    totalPrice,
    startTime,
    endTime,
    dbStatus,
    source,
    notesText || null,
  );

  const row = inserted[0];
  return {
    id: String(row.id),
    status: String(row.status || dbStatus).toUpperCase(),
    startTime: new Date(row.start_at),
    endTime: new Date(row.end_at),
    totalPrice: Number(row.total_price),
    priceCharged: Number(row.total_price),
    notes: row.customer_notes,
    customer: {
      firstName,
      lastName,
      phone: normalizedPhone,
    },
    pet: {
      name: String(petName).trim(),
      species: main.species,
    },
    services: serviceLines.map((line) => line.label),
    staff: null,
    message:
      status === 'PENDING'
        ? 'Booking received! We will confirm shortly.'
        : 'Booking saved.',
  };
}

module.exports = {
  CATALOG,
  catalogList,
  createBookingFromPayload,
  assertWithinGroomingHours,
  getBusyRangesForDate,
  assertSlotAvailable,
  BLOCKING_STATUSES,
};
