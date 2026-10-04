/**
 * scraperService - the one place the rest of the app asks "what are the readings
 * for this date?".
 *
 * Resolution order for a date:
 *   1. a hand-edited override saved in the database  (always wins)
 *   2. the readings_cache table, from a previous successful fetch
 *   3. each configured provider in turn, USCCB first
 *
 * Readings for a past date never change, so anything fetched is cached
 * permanently. That is what makes re-running a month's batch free - and what
 * makes a pre-fetched year instant, which is the whole point of the cache
 * living in PostgreSQL rather than in a folder of files. See the note on
 * readings_cache in db/schema.sql.
 */

import fs from 'node:fs';
import config from '../config.js';
import { assertIsoDate } from '../lib/dates.js';
import { auditReadings, emptyReadings, isComplete } from '../lib/readingsShape.js';
import { getSettings, query } from '../db/index.js';
import usccbProvider from './providers/usccbProvider.js';
import evangelizoProvider from './providers/evangelizoProvider.js';

const PROVIDERS = {
  [usccbProvider.id]: usccbProvider,
  [evangelizoProvider.id]: evangelizoProvider,
};

/**
 * The providers still keep their raw HTML here. Only the PARSED readings
 * moved to the database: re-parsing a page a provider already has is free, so
 * losing this folder costs a re-parse, whereas losing a parsed day used to
 * cost a fetch and possibly a three-minute cooldown.
 */
const RAW_CACHE_DIR = config.usccb.cacheDir;

/* ------------------------------------------------------------------ *
 * Parsed-readings cache
 * ------------------------------------------------------------------ */

/**
 * Bump this whenever the parsers change what they produce. Cached readings
 * stamped with an older version are ignored, so a parser fix reaches dates that
 * were already fetched. Re-parsing is nearly free: the provider still has the
 * page in its raw-HTML cache, so no request goes back out to the source.
 *
 *   2 - psalms with an alternative response ("or: R. Alleluia.") no longer keep
 *       the bare "or:" as a stanza of its own.
 *   3 - optional readings: a USCCB block headed only "or" is now understood as a
 *       further option for the section above it (8 September offers a choice of
 *       First Reading and of Gospel). The first option is used, as the office
 *       prints it, and the rest are recorded against the right section instead
 *       of being filed as "unrecognised".
 *   4 - line breaks: USCCB writes some pages (feast days, mostly) as
 *       "line<br>\nline". The source newline was being kept as a second break,
 *       so those readings printed with a blank line between every line.
 */
export const PARSER_VERSION = 4;

/**
 * A cached day, or null when the date was never fetched or was stamped by an
 * older parser.
 *
 * The WHERE clause asks for the current parser version rather than reading
 * the row and comparing in JavaScript, so a stale row costs nothing to skip.
 */
async function readParsedCache(iso) {
  if (!config.usccb.cacheEnabled) return null;
  try {
    const { rows } = await query(
      `SELECT payload, parser_version
          FROM readings_cache
         WHERE date = $1 AND parser_version = $2`,
      [iso, PARSER_VERSION],
    );
    if (!rows.length) return null;
    // payload is JSONB, so the driver has already parsed it.
    return { ...rows[0].payload, parserVersion: rows[0].parser_version };
  } catch (error) {
    // A cache is an optimisation. If the database is unreachable the caller
    // should go on to the provider, not fail.
    console.error('readings cache read failed:', error.message);
    return null;
  }
}

/**
 * Save a fetched day.
 *
 * ON CONFLICT rather than a DELETE then an INSERT: a batch run and a single
 * generate can be in flight for the same date at once, and the upsert makes
 * the later one win instead of one of them failing on the primary key.
 *
 * The transient fields the caller attached - whether this came from a cache,
 * which provider answered, what was attempted on the way - describe one
 * request, not the readings, and are stripped before storing. Keeping them
 * would mean later serving a cached day that claims `fromCache: false`.
 */
async function writeParsedCache(iso, readings) {
  if (!config.usccb.cacheEnabled) return;
  // eslint-disable-next-line no-unused-vars
  const { fromCache, origin, attempts, refetchable, ...payload } = readings;
  try {
    await query(
      `INSERT INTO readings_cache (date, payload, parser_version)
            VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (date) DO UPDATE
               SET payload        = EXCLUDED.payload,
                   parser_version = EXCLUDED.parser_version,
                   fetched_at     = now()`,
      [iso, JSON.stringify(payload), PARSER_VERSION],
    );
  } catch (error) {
    /* the cache is an optimisation, never a requirement */
    console.error('readings cache write failed:', error.message);
  }
}

/**
 * Whether a cached day can be served as-is, or must be re-fetched first.
 *
 * A complete day is final - readings for a date never change. An incomplete one
 * is final only when the *preferred* source produced it, because then the gap is
 * the day itself (the Triduum has no Gospel Acclamation) rather than a failure.
 * An incomplete day from a lesser source is a stand-in saved while the preferred
 * source was unreachable, and is replaced as soon as it can be.
 *
 * @param {object} cached   the parsed cache entry
 * @param {string} preferred  id of the first provider in the configured order
 */
export function canServeFromCache(cached, preferred) {
  if (!cached) return false;
  if (isComplete(cached)) return true;
  return String(cached.source || '').startsWith(preferred);
}

/**
 * Throw away cached readings - one date, or everything.
 *
 * Clearing everything drops the raw HTML too, because the two caches are
 * only consistent together: keeping pages whose parsed rows are gone would
 * make the next fetch look instant and come from a page nobody re-checked.
 */
export async function clearCache(iso = null) {
  try {
    if (iso) {
      await query('DELETE FROM readings_cache WHERE date = $1', [iso]);
    } else {
      await query('TRUNCATE readings_cache');
      fs.rmSync(RAW_CACHE_DIR, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    console.error('clearCache failed:', error.message);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Manual overrides
 * ------------------------------------------------------------------ */

/**
 * `payload` is JSONB, so the driver returns the object itself. The SQLite
 * version stored JSON in a TEXT column and had to JSON.parse it inside a
 * try/catch against a row that might hold something unparseable; a JSONB column
 * cannot hold invalid JSON, so that whole branch is gone.
 */
export async function getOverride(iso) {
  const { rows } = await query(
    'SELECT payload, source, updated_at FROM readings_overrides WHERE date = $1',
    [iso],
  );
  if (!rows.length) return null;
  const [row] = rows;
  return { ...row.payload, source: row.source || 'manual', overriddenAt: row.updated_at };
}

/**
 * Save corrected readings for a date. Accepts a full readings object or a patch
 * merged onto whatever we already have (that is how the editor saves one field).
 */
export async function saveOverride(iso, patch, { merge = true } = {}) {
  assertIsoDate(iso);
  let payload = patch;

  if (merge) {
    const base = (await getOverride(iso)) || readParsedCache(iso) || emptyReadings(iso, 'manual');
    payload = { ...base, ...patch, date: iso };
    // Merge one level into the section objects so a caller can send just
    // { psalm: { refrain: "..." } } without wiping the verses.
    for (const key of ['reading1', 'reading2', 'sequence', 'gospel', 'psalm', 'acclamation']) {
      if (patch[key] && base[key]) payload[key] = { ...base[key], ...patch[key] };
    }
  }

  payload.date = iso;
  payload.source = payload.source === 'manual' ? 'manual' : `${payload.source || 'unknown'}+manual`;
  payload.warnings = auditReadings(payload);

  await query(
    `INSERT INTO readings_overrides (date, payload, source, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (date) DO UPDATE SET
       payload = excluded.payload, source = excluded.source, updated_at = now()`,
    [iso, JSON.stringify(payload), payload.source],
  );

  return payload;
}

/** `.changes` became `rowCount`. */
export async function deleteOverride(iso) {
  const { rowCount } = await query('DELETE FROM readings_overrides WHERE date = $1', [iso]);
  return rowCount > 0;
}

/**
 * Import readings from a page the user saved themselves. The USCCB parser is
 * reused, so a saved MMDDYY.cfm page gives exactly the same fidelity as a live
 * fetch - the practical answer when USCCB is showing its bot check.
 */
export async function importFromHtml(iso, html) {
  assertIsoDate(iso);
  if (!html || typeof html !== 'string' || html.length < 200) {
    const err = new Error('Paste the full saved USCCB readings page - that looked too short to be one.');
    err.status = 400;
    throw err;
  }
  const parsed = usccbProvider.parse(html, iso);
  parsed.source = 'usccb (imported)';
  parsed.warnings = auditReadings(parsed);
  writeParsedCache(iso, parsed);
  return saveOverride(iso, parsed, { merge: false });
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

async function resolveProviderOrder(requested) {
  const configured = requested || (await getSettings()).providerOrder || ['usccb'];
  const order = configured.filter((name) => PROVIDERS[name]);
  return order.length ? order : ['usccb'];
}

/**
 * Readings for one date. Never throws for a partial result - the returned object
 * always carries `warnings` describing what is missing.
 */
export async function getReadings(iso, options = {}) {
  assertIsoDate(iso);
  const { force = false, providers = null, useCache = true, useOverride = true } = options;

  if (useOverride) {
    const override = await getOverride(iso);
    if (override) {
      override.warnings = auditReadings(override);
      override.fromCache = true;
      override.origin = 'override';
      return override;
    }
  }

  const order = await resolveProviderOrder(providers);
  const attempts = [];

  /**
   * A fallback result saved while USCCB was blocking us is held only until a
   * better source is reachable. Without this, one bot challenge left a date
   * permanently without its psalm response and Gospel Acclamation: the partial
   * Evangelizo copy was cached, and every later request was served from that
   * cache instead of retrying USCCB.
   */
  let provisional = null;

  if (useCache && !force) {
    const cached = await readParsedCache(iso);
    if (cached) {
      cached.warnings = auditReadings(cached);
      cached.fromCache = true;
      cached.origin = 'cache';
      if (canServeFromCache(cached, order[0])) return cached;
      provisional = cached;
    }
  }

  for (const name of order) {
    const provider = PROVIDERS[name];
    try {
      const readings = await provider.fetchReadings(iso);
      readings.warnings = [...(readings.warnings || []), ...auditReadings(readings)];
      readings.fromCache = false;
      readings.origin = name;
      readings.attempts = attempts;
      await writeParsedCache(iso, readings);
      return readings;
    } catch (error) {
      attempts.push({
        provider: name,
        code: error.code || 'ERROR',
        message: error.message,
      });
    }
  }

  // Every source failed. A partial copy still beats printing nothing.
  if (provisional) {
    provisional.attempts = attempts;
    return provisional;
  }

  const err = new Error(
    `No source could supply the readings for ${iso}. ` +
      attempts.map((a) => `${a.provider}: ${a.message}`).join(' | '),
  );
  err.status = 502;
  err.code = 'NO_PROVIDER';
  err.attempts = attempts;
  err.date = iso;
  throw err;
}

/**
 * The readings already on hand for a date - a saved correction or a cached
 * fetch - without asking any source. Null when the date was never fetched.
 *
 * `refetchable` marks a partial copy from the fallback feed: getReadings would
 * go back to the preferred source for it, so fetching again may fill the gaps.
 */
export async function peekReadings(iso, { providers = null } = {}) {
  assertIsoDate(iso);
  const override = await getOverride(iso);
  if (override) {
    return { ...override, warnings: auditReadings(override), origin: 'override', refetchable: false };
  }
  const cached = await readParsedCache(iso);
  if (!cached) return null;
  return {
    ...cached,
    warnings: auditReadings(cached),
    origin: 'cache',
    refetchable: !canServeFromCache(cached, (await resolveProviderOrder(providers))[0]),
  };
}

/**
 * How long the preferred source wants to be left alone before it is asked again,
 * in milliseconds; 0 when it may be asked now.
 *
 * Batch generation uses this to hold between dates rather than spend the rest of
 * the run on the fallback feed - see batchService.
 */
export async function preferredCooldownMs(requested = null) {
  const provider = PROVIDERS[(await resolveProviderOrder(requested))[0]];
  return provider && provider.challengeCooldownMs ? provider.challengeCooldownMs() : 0;
}

export function providerStatus() {
  return Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    queued: provider.queue ? provider.queue.pending : 0,
  }));
}

export const providers = PROVIDERS;

export default {
  getReadings,
  peekReadings,
  getOverride,
  saveOverride,
  deleteOverride,
  importFromHtml,
  clearCache,
  providerStatus,
};
