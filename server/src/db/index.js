/**
 * PostgreSQL storage.
 *
 * This replaced a better-sqlite3 layer. Three things changed everywhere and are
 * worth knowing before reading anything below:
 *
 *   1. Every call is asynchronous. better-sqlite3 returned a row; `pg` returns
 *      a promise of `{ rows, rowCount }`. Every function here is `async`, and
 *      so is everything that calls one.
 *
 *   2. Placeholders are numbered. `?` and `@named` became `$1`, `$2`, with the
 *      values in an array.
 *
 *   3. There is no `lastInsertRowid`. You ask for what you want back with
 *      `RETURNING`, which also removes the follow-up SELECT several call sites
 *      used to do.
 *
 * The schema is no longer built by a migrations array in JavaScript. It lives
 * in `server/db/schema.sql`, is applied by `npm run db:schema`, and is readable
 * by opening a file rather than by running the app. `server/db/seed.sql` holds
 * the settings defaults and the placeholder prayers.
 */

import pg from 'pg';

/*
 * DATE columns come back as strings, not JS Date objects.
 *
 * This single line is the most important one in the file. By default
 * node-postgres parses a DATE (type OID 1082) into `new Date(y, m-1, d)` -
 * LOCAL midnight. The API runs on a host in UTC and the office is in UTC+8, so
 * a date read back and re-formatted would land a day early, and for a
 * liturgical calendar "a day early" means printing Tuesday's readings for
 * Wednesday's Mass. Handing the raw 'YYYY-MM-DD' string straight through means
 * no timezone is ever applied to a value that has no time in it.
 */
pg.types.setTypeParser(1082, (value) => value);

/**
 * The pool, resolved lazily.
 *
 * `db/pool.js` exits the process when DATABASE_URL is missing, which is right
 * for a server and wrong for a test run, so it is imported only when actually
 * needed. `useTestPool()` lets the tests put an in-process PostgreSQL here
 * instead.
 */
let override = null;
let cached = null;

export function useTestPool(pool) {
  override = pool;
}

export function resetPool() {
  override = null;
  cached = null;
}

async function getPool() {
  if (override) return override;
  if (!cached) ({ pool: cached } = await import('../../db/pool.js'));
  return cached;
}

/** Run one statement. The only way this module talks to PostgreSQL. */
export async function query(text, params = []) {
  return (await getPool()).query(text, params);
}

/**
 * Run several statements as one unit, on a single checked-out client.
 *
 * `db.transaction(fn)()` in better-sqlite3 became this. The `finally` is not
 * optional: a client that is never released is a connection the pool never
 * gets back, and the free tiers allow very few.
 */
export async function withTransaction(run) {
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Normalise a DATE from the driver to 'YYYY-MM-DD'.
 *
 * With the type parser above, real PostgreSQL already hands back a string and
 * this only trims it. pg-mem, used by the tests, still returns a Date at UTC
 * midnight, so the Date branch reads it with UTC getters - never local ones,
 * for the reason in the comment at the top of this file.
 */
export function isoFromDb(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The one query /readyz runs. */
export async function checkDatabase() {
  await query('SELECT 1');
  return true;
}

/** Close the pool. Used by tests and by a clean shutdown. */
export async function closeDb() {
  if (override) return;
  if (cached) {
    await cached.end();
    cached = null;
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

/**
 * `value` is JSONB, so the driver hands back a real JS value - a boolean, a
 * string, an array. The SQLite version stored JSON in a TEXT column and had to
 * JSON.parse every row inside a try/catch; that work is gone.
 */
export async function getSettings(orgId) {
  // No parish means no stored settings to find - which is the honest answer
  // for a brand new account, and better than reading every parish's rows.
  if (!orgId) return { ...DEFAULT_SETTINGS };
  const { rows } = await query('SELECT key, value FROM settings WHERE org_id = $1', [orgId]);
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Write settings, all of them or none.
 *
 * JSON.stringify stays on the way IN: a JS value has to be serialised to go
 * into a JSONB parameter. It is only the read side that got simpler.
 */
export async function setSettings(orgId, patch) {
  if (!orgId) {
    throw Object.assign(new Error('Settings belong to a parish, and this account has none yet.'), { status: 403 });
  }
  const entries = Object.entries(patch);
  if (entries.length) {
    await withTransaction(async (client) => {
      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO settings (org_id, key, value, updated_at) VALUES ($1, $2, $3::jsonb, now())
           ON CONFLICT (org_id, key) DO UPDATE SET value = excluded.value, updated_at = now()`,
          [orgId, key, JSON.stringify(value)],
        );
      }
    });
  }
  return getSettings(orgId);
}

export default { query, withTransaction, getSettings, setSettings, DEFAULT_SETTINGS };
