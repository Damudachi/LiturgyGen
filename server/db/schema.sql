-- LiturgyGen: the complete shape of the PostgreSQL database.
--
-- Safe to run against an empty database, and safe to run twice.
--
-- This file is committed on purpose. The schema is a fact about the
-- application, not a runtime concern: it should be readable by opening a file
-- rather than by connecting to a server.
--
-- Written from the five better-sqlite3 migrations in src/db/index.js, flattened
-- into one file because the SQLite database is being replaced rather than
-- carried forward. What changed in the translation, and why, is in
-- docs/07-postgres-migration-map.md.
--
--   npm run db:schema      (node db/run.js db/schema.sql)


-- ---------------------------------------------------------------------------
-- Prayers of the Faithful templates
-- ---------------------------------------------------------------------------
-- One row per prayer page. A page is matched to a date by a cascade that runs
-- from the most specific key to the least: celebration_id, then fixed_date
-- (MM-DD, for the stretches of the book keyed to the calendar rather than the
-- liturgical week), then season + week + day_of_week, then broader.
--
-- response_options and intentions are lists. In SQLite they were TEXT holding
-- JSON, parsed and re-serialised by hand on every read and write. PostgreSQL
-- has JSONB, so they are stored as what they are and the application stops
-- doing that work.

CREATE TABLE IF NOT EXISTS potf_templates (
  id                 SERIAL       PRIMARY KEY,
  title              TEXT         NOT NULL,
  season             TEXT         NOT NULL,
  week               INTEGER,
  day_of_week        TEXT,
  celebration_id     TEXT,
  fixed_date         TEXT,                                 -- 'MM-DD'
  priest_invitation  TEXT         NOT NULL DEFAULT '',
  response_options   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  intentions         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  priest_conclusion  TEXT         NOT NULL DEFAULT '',
  notes              TEXT,
  origin             TEXT         NOT NULL DEFAULT 'custom',
  -- Fingerprint of the text the seeder last wrote. A row still matching its
  -- fingerprint has never been edited and may be refreshed; anything else is
  -- the office's own work and is left alone. Timestamps cannot tell us this.
  seed_hash          TEXT,
  -- Placeholders are prayers written for this tool, not taken from either book.
  -- A date only resolves to one when the office has asked for that.
  is_placeholder     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT potf_week_range CHECK (week IS NULL OR week BETWEEN 1 AND 34),
  CONSTRAINT potf_fixed_date_shape CHECK (fixed_date IS NULL OR fixed_date ~ '^\d{2}-\d{2}$'),
  CONSTRAINT potf_title_length CHECK (char_length(title) BETWEEN 1 AND 200)
);

-- The cascade's hot path: season + week + weekday, checked for every date in a
-- batch. Without this the matcher reads the whole table per day.
CREATE INDEX IF NOT EXISTS idx_potf_lookup
  ON potf_templates (season, week, day_of_week);

CREATE INDEX IF NOT EXISTS idx_potf_celebration
  ON potf_templates (celebration_id);

CREATE INDEX IF NOT EXISTS idx_potf_fixed_date
  ON potf_templates (fixed_date);


-- ---------------------------------------------------------------------------
-- Hand-corrected readings
-- ---------------------------------------------------------------------------
-- A psalm response the source omitted, a citation the office prefers. An
-- override always wins over the scrape, for that date, permanently.

CREATE TABLE IF NOT EXISTS readings_overrides (
  date        DATE         PRIMARY KEY,
  payload     JSONB        NOT NULL,
  source      TEXT         NOT NULL DEFAULT 'manual',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT readings_source_known CHECK (source IN ('manual', 'import', 'usccb', 'evangelizo'))
);


-- ---------------------------------------------------------------------------
-- Application settings
-- ---------------------------------------------------------------------------
-- A key/value bag rather than a wide row: the settings list grows most terms,
-- and a new checkbox should not be a migration.

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT         PRIMARY KEY,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- The office's Mass schedule
-- ---------------------------------------------------------------------------
-- Dates the office has committed to, so a batch can be built from "our
-- scheduled Masses" rather than re-picking them every month.

CREATE TABLE IF NOT EXISTS scheduled_masses (
  date        DATE         PRIMARY KEY,
  label       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT scheduled_label_length CHECK (label IS NULL OR char_length(label) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_date
  ON scheduled_masses (date);
