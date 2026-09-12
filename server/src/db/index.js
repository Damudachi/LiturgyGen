/**
 * SQLite storage. One file on disk, no server to install - the whole point of a
 * local tool the Campus Ministry Office can run without IT support.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config.js';

let db = null;

const MIGRATIONS = [
  {
    id: '001-initial',
    up: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS potf_templates (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          title              TEXT    NOT NULL,
          season             TEXT    NOT NULL,
          week               INTEGER,
          day_of_week        TEXT,
          celebration_id     TEXT,
          priest_invitation  TEXT    NOT NULL DEFAULT '',
          response_options   TEXT    NOT NULL DEFAULT '[]',
          intentions         TEXT    NOT NULL DEFAULT '[]',
          priest_conclusion  TEXT    NOT NULL DEFAULT '',
          notes              TEXT,
          origin             TEXT    NOT NULL DEFAULT 'custom',
          is_active          INTEGER NOT NULL DEFAULT 1,
          created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_potf_lookup
          ON potf_templates (season, week, day_of_week);
        CREATE INDEX IF NOT EXISTS idx_potf_celebration
          ON potf_templates (celebration_id);

        /* Hand-corrected readings for a date - a psalm response the source
           omitted, a citation the office prefers. Always wins over the scrape. */
        CREATE TABLE IF NOT EXISTS readings_overrides (
          date        TEXT PRIMARY KEY,
          payload     TEXT NOT NULL,
          source      TEXT NOT NULL DEFAULT 'manual',
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          key         TEXT PRIMARY KEY,
          value       TEXT NOT NULL,
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
  {
    id: '002-schedule',
    up: (database) => {
      database.exec(`
        /* Dates the office has committed to, so a batch can be built from
           "our scheduled Masses" rather than re-picking them every month. */
        CREATE TABLE IF NOT EXISTS scheduled_masses (
          date        TEXT PRIMARY KEY,
          label       TEXT,
          notes       TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
  {
    id: '003-seed-fingerprint',
    up: (database) => {
      /* Fingerprint of the text the seeder last wrote. A row still matching its
         fingerprint has never been edited and may be refreshed; anything else is
         the office's own work and is left alone. Timestamps cannot tell us this:
         refreshing a row bumps updated_at, which made every seed row look edited
         from the second run onwards. */
      database.exec('ALTER TABLE potf_templates ADD COLUMN seed_hash TEXT;');
    },
  },
  {
    id: '004-fixed-date',
    up: (database) => {
      /* Some stretches of the book are keyed to the calendar rather than to the
         liturgical week - 17 to 24 December, and 2 to 5 January. Celebration ids
         cannot carry those: because the Philippines keeps Epiphany on a Sunday,
         2 January is Epiphany in one year and a weekday after it in the next, and
         the days that follow are named by weekday rather than by date. A plain
         MM-DD match is what the book actually means. */
      database.exec("ALTER TABLE potf_templates ADD COLUMN fixed_date TEXT;");
      database.exec('CREATE INDEX IF NOT EXISTS idx_potf_fixed_date ON potf_templates (fixed_date);');
    },
  },
  {
    id: '005-placeholder',
    up: (database) => {
      /* Placeholders are prayers written for this tool, not taken from either
         book. They stay in the database so the office can pick one by hand, but
         a date only resolves to one when the office has asked for that - the
         default for a day the books miss is no prayer and a warning, never a
         made-up text passed off as the book's. The seeder sets the flag. */
      database.exec('ALTER TABLE potf_templates ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0;');
    },
  },
];

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    database.prepare('SELECT id FROM _migrations').all().map((row) => row.id),
  );
  const insert = database.prepare('INSERT INTO _migrations (id) VALUES (?)');

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    database.transaction(() => {
      migration.up(database);
      insert.run(migration.id);
    })();
  }
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS = {
  includeGospel: false,
  includeSequence: true,
  /** Each reading and the prayers start on a fresh page. */
  separatePages: true,
  /** Highlight the opening psalm response so the assembly can find it. */
  highlightFirstRefrain: true,
  repeatPsalmRefrain: true,
  firstRefrainUppercase: true,
  appendIntentionSuffix: true,
  spaceBetweenIntentions: true,
  font: 'Book Antiqua',
  /** Intentions appended to every generated day, e.g. for the school patron. */
  schoolWideIntentions: [],
  /**
   * When neither book has a prayer for a day (Sundays, most often - both
   * volumes are for weekday Masses), fall back to a placeholder written for
   * this tool. Off by default: such a day prints no prayers and says so.
   */
  usePlaceholderPotf: false,
  /** Provider order used when fetching readings. */
  providerOrder: ['usccb', 'evangelizo'],
};

export function getSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const stored = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      stored[row.key] = row.value;
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function setSettings(patch) {
  const statement = getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  getDb().transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      statement.run(key, JSON.stringify(value));
    }
  })();
  return getSettings();
}

export default { getDb, closeDb, getSettings, setSettings, DEFAULT_SETTINGS };
