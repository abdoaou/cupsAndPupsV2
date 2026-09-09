# Cups & Pups

Unified platform for a **pet grooming center**, **pet-friendly café**, and **pet shop** — one customer profile, shared loyalty, shared inventory, and a single owner dashboard.

## Stack

| Layer | Choice |
|---|---|
| API | Node.js + Express + Prisma |
| Web | Node.js + Express (static HTML/CSS/JS) |
| DB | PostgreSQL + Prisma |
| Cache / locks | Redis (wired in Phase 1+ booking) |
| Auth | JWT access + rotating refresh tokens, Argon2 hashes, RBAC |

Monorepo layout:

```
apps/api          Express REST API (`/api/v1`)
apps/web          Customer-facing Express site (HTML/CSS/JS)
packages/shared   Shared enums/helpers
```

## MVP assumptions (open questions)

Until you say otherwise, Phase 1 uses:

- **Fulfillment:** pickup in store only (delivery later)
- **Grooming payments:** deposit supported in the data model; pay-at-visit OK for early bookings
- **Locations:** multi-location-aware schema from day one; seed ships one `main` location
- **Payments:** Stripe (keys optional until checkout/POS land)
- **Clients:** mobile-optimized web / PWA path (no native apps yet)

## Quick start

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

### 3. Infrastructure

Requires Docker Desktop (or any local Postgres 16 + Redis 7):

```bash
docker compose up -d
```

If Docker is unavailable, point `DATABASE_URL` / `REDIS_URL` in `.env` at your own instances.
### 4. Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Run

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

- Web: http://localhost:3000  
- API health: http://localhost:4000/api/v1/health  

### Seed logins

| Role | Email | Password |
|---|---|---|
| Admin | `owner@cupsandpups.local` | `Password123!` |
| Customer | `customer@example.com` | `Password123!` |

## Auth API (live)

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
PATCH /api/v1/me
GET  /api/v1/me/pets
POST /api/v1/me/pets
PATCH /api/v1/pets/:id
DELETE /api/v1/pets/:id
```

Staff/admin routes use `@Roles(...)` + global `RolesGuard`. Auth endpoints are rate-limited.

## Admin (live)

- Login: http://localhost:3000/admin/login  
  (`owner@cupsandpups.local` / `Password123!`)
- Dashboard: http://localhost:3000/admin
- Bookings: http://localhost:3000/admin/bookings
- Products CRUD: http://localhost:3000/admin/products
- Café menu CRUD: http://localhost:3000/admin/menu

```
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/appointments
GET    /api/v1/admin/products
POST   /api/v1/admin/products
PATCH  /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id
GET    /api/v1/admin/menu
POST   /api/v1/admin/menu
PATCH  /api/v1/admin/menu/:id
DELETE /api/v1/admin/menu/:id
GET    /api/v1/menu
```

Railway coffee menu import lives in `scripts/railway-menu.json` (58 items). Booking SQL: `scripts/bookings-table.sql`.

## Build phases

1. **Now / next:** auth, pets, grooming booking + calendar locks, product catalog + pickup orders, unified POS shell, basic admin revenue view  
2. **Then:** loyalty, café pre-order, inventory alerts, SMS  
3. **Later:** QR table ordering, delivery, subscriptions, multi-location ops, advanced exports  

## Design notes

Customer site: espresso + oat + sage, Nunito / Source Sans 3, full-bleed photography hero with brand-first hierarchy. Served by Express as static HTML/CSS/JS (no Next.js).
