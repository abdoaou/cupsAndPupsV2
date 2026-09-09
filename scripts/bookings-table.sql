-- Cups & Pups — Booking table (standalone SQL)
-- Run against PostgreSQL. Safe to re-run: uses IF NOT EXISTS.

-- Optional status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM (
      'pending',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pet_size') THEN
    CREATE TYPE pet_size AS ENUM ('small', 'medium', 'large', 'cat');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'groom_service_type') THEN
    CREATE TYPE groom_service_type AS ENUM (
      'shower',
      'shower_cutting',
      'nail_cutting'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
  id                BIGSERIAL PRIMARY KEY,

  -- Who / what
  customer_id       BIGINT,
  customer_name     VARCHAR(120) NOT NULL,
  customer_phone    VARCHAR(40),
  customer_email    VARCHAR(160),

  pet_name          VARCHAR(120) NOT NULL,
  pet_species       VARCHAR(40) DEFAULT 'dog',   -- dog | cat | other
  pet_breed         VARCHAR(120),
  pet_size          pet_size NOT NULL,
  pet_weight_kg     NUMERIC(6,2),
  pet_notes         TEXT,                        -- temperament / allergies
  vaccination_ok    BOOLEAN DEFAULT FALSE,

  -- Service
  service_type      groom_service_type NOT NULL,
  service_label     VARCHAR(120) NOT NULL,       -- e.g. "Small dog — Shower + cut"
  duration_minutes  INT NOT NULL DEFAULT 60,
  buffer_minutes    INT NOT NULL DEFAULT 15,
  price             NUMERIC(10,2) NOT NULL,
  addons_json       JSONB DEFAULT '[]'::jsonb,   -- e.g. [{"name":"Nail cutting","price":2}]
  addons_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price       NUMERIC(10,2) NOT NULL,

  -- Schedule
  location_id       BIGINT,
  groomer_id        BIGINT,
  groomer_name      VARCHAR(120),
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,

  -- Workflow
  status            booking_status NOT NULL DEFAULT 'pending',
  source            VARCHAR(40) NOT NULL DEFAULT 'admin', -- admin | online | phone | walkin
  deposit_amount    NUMERIC(10,2) DEFAULT 0,
  deposit_paid      BOOLEAN NOT NULL DEFAULT FALSE,
  paid_in_full      BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method    VARCHAR(40),                 -- cash | card | stripe | mixed

  -- Notes / media
  customer_notes    TEXT,
  staff_notes       TEXT,
  cancellation_reason TEXT,
  cancelled_at      TIMESTAMPTZ,
  checked_in_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  before_photo_url  TEXT,
  after_photo_url   TEXT,

  -- Reminders
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_2h_sent  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bookings_end_after_start CHECK (end_at > start_at),
  CONSTRAINT bookings_price_nonneg CHECK (price >= 0 AND total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings (start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_groomer_start ON bookings (groomer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings (customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_pet_size ON bookings (pet_size);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE PROCEDURE set_bookings_updated_at();

-- Reference price list (optional helper table for your grooming menu)
CREATE TABLE IF NOT EXISTS grooming_price_list (
  id            BIGSERIAL PRIMARY KEY,
  pet_size      pet_size NOT NULL,
  service_type  groom_service_type NOT NULL,
  label         VARCHAR(120) NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (pet_size, service_type)
);

INSERT INTO grooming_price_list (pet_size, service_type, label, price, duration_minutes)
VALUES
  ('small',  'shower',          'Small dog — Shower',          8,  60),
  ('small',  'shower_cutting',  'Small dog — Shower + cutting', 15, 90),
  ('medium', 'shower',          'Medium dog — Shower',         10, 60),
  ('medium', 'shower_cutting',  'Medium dog — Shower + cutting', 20, 90),
  ('large',  'shower',          'Large dog — Shower',          15, 60),
  ('large',  'shower_cutting',  'Large dog — Shower + cutting', 25, 90),
  ('cat',    'shower',          'Cat — Shower',                 8, 60),
  ('cat',    'shower_cutting',  'Cat — Shower + cutting',       15, 90),
  ('small',  'nail_cutting',    'Nail cutting',                 2, 15),
  ('medium', 'nail_cutting',    'Nail cutting',                 2, 15),
  ('large',  'nail_cutting',    'Nail cutting',                 2, 15),
  ('cat',    'nail_cutting',    'Nail cutting',                 2, 15)
ON CONFLICT (pet_size, service_type) DO UPDATE
SET label = EXCLUDED.label,
    price = EXCLUDED.price,
    duration_minutes = EXCLUDED.duration_minutes,
    is_active = TRUE;

-- Example insert
-- INSERT INTO bookings (
--   customer_name, customer_phone, pet_name, pet_size, service_type, service_label,
--   duration_minutes, price, total_price, start_at, end_at, status
-- ) VALUES (
--   'Sam Customer', '+15550102', 'Buddy', 'large', 'shower_cutting',
--   'Large dog — Shower + cutting', 95, 25, 27,
--   NOW() + INTERVAL '2 hours', NOW() + INTERVAL '2 hours 95 minutes', 'confirmed'
-- );
