const STORAGE_KEY = 'cupsGuestGroomingBookings';

export function isLoggedIn() {
  return Boolean(localStorage.getItem('accessToken'));
}

export function getGuestBookings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveGuestBooking(booking) {
  const list = getGuestBookings().filter((b) => b.id !== booking.id);
  list.push({
    id: booking.id,
    status: booking.status || 'PENDING',
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalPrice: booking.totalPrice,
    pet: booking.pet || { name: booking.petName },
    services: booking.services || [],
    customerName: booking.customerName,
    phone: booking.phone,
    source: 'local',
    savedAt: new Date().toISOString(),
  });
  list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function clearPastGuestBookings() {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  const list = getGuestBookings().filter(
    (b) => new Date(b.endTime || b.startTime).getTime() >= cutoff,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function formatBookingDate(startTime) {
  return new Date(startTime).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatBookingTime(startTime, endTime) {
  const start = new Date(startTime);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endTime) return startLabel;
  const endLabel = new Date(endTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatBookingWhen(startTime, endTime) {
  return `${formatBookingDate(startTime)} · ${formatBookingTime(startTime, endTime)}`;
}

export function mergeBookings(primary = [], secondary = []) {
  const map = new Map();
  [...secondary, ...primary].forEach((b) => {
    if (!b?.id && !b?.startTime) return;
    const key = b.id || `${b.startTime}-${b.pet?.name || ''}`;
    map.set(key, b);
  });
  return [...map.values()].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime),
  );
}

export function renderBookingCards(bookings, { emptyText } = {}) {
  if (!bookings?.length) {
    return `<p class="slot-empty">${emptyText || 'No grooming bookings yet.'}</p>`;
  }

  return bookings
    .map((b) => {
      const petName = b.pet?.name || b.petName || 'Pet';
      const services = (b.services || []).join(' + ') || 'Grooming';
      const price =
        b.totalPrice != null ? `$${Number(b.totalPrice).toFixed(2)}` : '';
      const status = (b.status || 'PENDING').replace(/_/g, ' ');
      const dateLabel = formatBookingDate(b.startTime);
      const timeLabel = formatBookingTime(b.startTime, b.endTime);
      const past = new Date(b.endTime || b.startTime).getTime() < Date.now();

      return `<article class="my-booking-card${past ? ' past' : ''}">
        <div class="my-booking-when">
          <span class="my-booking-day">${new Date(b.startTime).toLocaleDateString(undefined, {
            weekday: 'short',
          })}</span>
          <strong>${new Date(b.startTime).getDate()}</strong>
          <span>${new Date(b.startTime).toLocaleDateString(undefined, {
            month: 'short',
          })}</span>
        </div>
        <div class="my-booking-body">
          <h3>${petName}</h3>
          <dl class="my-booking-datetime">
            <div>
              <dt>Date</dt>
              <dd>${dateLabel}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>${timeLabel}</dd>
            </div>
          </dl>
          <p class="my-booking-services">${services}</p>
          <div class="my-booking-meta">
            <span class="status-pill">${status}</span>
            ${price ? `<span>${price}</span>` : ''}
          </div>
        </div>
      </article>`;
    })
    .join('');
}
