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

async function findOverlappingAppointments(startTime, endTime, locationId, { excludeId } = {}) {
  const where = {
    locationId,
    status: { in: BLOCKING_STATUSES },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };
  if (excludeId) where.id = { not: excludeId };

  return prisma.appointment.findMany({
    where,
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });
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

  const rows = await prisma.appointment.findMany({
    where: {
      locationId,
      status: { in: BLOCKING_STATUSES },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
  });

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

  const location = await prisma.location.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!location) throw new HttpError(404, 'No active location found');

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

  await assertSlotAvailable(startTime, endTime, location.id);

  const normalizedPhone = normalizePhone(phone);
  const { firstName, lastName } = splitName(customerName);

  const appointment = await prisma.$transaction(async (tx) => {
    let customer = null;

    if (authUserId) {
      customer = await tx.user.findUnique({ where: { id: authUserId } });
      if (customer) {
        customer = await tx.user.update({
          where: { id: customer.id },
          data: {
            firstName,
            lastName,
            phone: customer.phone || normalizedPhone,
          },
        });
      }
    }

    if (!customer) {
      customer = await tx.user.findFirst({
        where: { phone: normalizedPhone },
      });
    }

    if (!customer) {
      const email = `guest+${normalizedPhone.replace(/\D/g, '')}@cupsandpups.local`;
      const existingEmail = await tx.user.findUnique({ where: { email } });
      if (existingEmail) {
        customer = existingEmail;
        if (!customer.phone) {
          customer = await tx.user.update({
            where: { id: customer.id },
            data: { phone: normalizedPhone, firstName, lastName },
          });
        }
      } else {
        customer = await tx.user.create({
          data: {
            email,
            phone: normalizedPhone,
            firstName,
            lastName,
            role: 'CUSTOMER',
            loyaltyAccount: { create: {} },
          },
        });
      }
    } else if (!authUserId) {
      customer = await tx.user.update({
        where: { id: customer.id },
        data: { firstName, lastName },
      });
    }

    let pet = await tx.pet.findFirst({
      where: {
        ownerId: customer.id,
        name: { equals: String(petName).trim(), mode: 'insensitive' },
        isActive: true,
      },
    });

    if (!pet) {
      pet = await tx.pet.create({
        data: {
          ownerId: customer.id,
          name: String(petName).trim(),
          species: main.species,
          sizeCategory: main.sizeCategory,
        },
      });
    } else {
      pet = await tx.pet.update({
        where: { id: pet.id },
        data: {
          species: main.species,
          sizeCategory: main.sizeCategory,
        },
      });
    }

    const serviceRecords = [];
    for (const line of serviceLines) {
      let service = await tx.service.findFirst({
        where: { locationId: location.id, name: line.label },
      });
      if (!service) {
        service = await tx.service.create({
          data: {
            locationId: location.id,
            name: line.label,
            description: 'Online booking service',
            category: 'grooming',
            basePrice: line.price,
            durationMinutes: line.durationMinutes,
            bufferMinutes: 15,
          },
        });
      }
      serviceRecords.push({ service, line });
    }

    const notesParts = [
      sourceNote,
      `Phone: ${normalizedPhone}`,
      `Selected: ${serviceLines.map((s) => s.label).join(' + ')}`,
      notes?.trim() || null,
    ].filter(Boolean);

    return tx.appointment.create({
      data: {
        locationId: location.id,
        customerId: customer.id,
        petId: pet.id,
        startTime,
        endTime,
        status,
        priceCharged: totalPrice,
        notes: notesParts.join(' · '),
        services: {
          create: serviceRecords.map(({ service, line }) => ({
            serviceId: service.id,
            price: line.price,
            durationMinutes: line.durationMinutes,
          })),
        },
      },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        services: { include: { service: { select: { name: true } } } },
        staff: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  });

  return {
    id: appointment.id,
    status: appointment.status,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    totalPrice: Number(appointment.priceCharged ?? totalPrice),
    priceCharged: Number(appointment.priceCharged ?? totalPrice),
    notes: appointment.notes,
    customer: appointment.customer,
    pet: appointment.pet,
    services: appointment.services.map((s) => s.service.name),
    staff: appointment.staff
      ? `${appointment.staff.user.firstName} ${appointment.staff.user.lastName}`
      : null,
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
