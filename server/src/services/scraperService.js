/**
 * scraperService - the one place the rest of the app asks "what are the readings
 * for this date?".
 *
 * Resolution order for a date:
 *   1. a hand-edited override saved in the database  (always wins)
 *   2. the on-disk cache of a previous successful fetch
 *   3. each configured provider in turn, USCCB first
 *
 * Readings for a past date never change, so anything fetched is cached
 * permanently. That is what makes re-running a month's batch free.
 */

import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';
import { assertIsoDate } from '../lib/dates.js';
import { auditReadings, emptyReadings, isComplete } from '../lib/readingsShape.js';
import { getDb, getSettings } from '../db/index.js';
import usccbProvider from './providers/usccbProvider.js';
import evangelizoProvider from './providers/evangelizoProvider.js';

const PROVIDERS = {
  [usccbProvider.id]: usccbProvider,
  [evangelizoProvider.id]: evangelizoProvider,
};

const CACHE_DIR = path.join(path.dirname(config.usccb.cacheDir), 'readings');

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

function cacheFile(iso) {
  return path.join(CACHE_DIR, `${iso}.json`);
}

function readParsedCache(iso) {
  if (!config.usccb.cacheEnabled) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile(iso), 'utf8'));
    if (cached.parserVersion !== PARSER_VERSION) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeParsedCache(iso, readings) {
  if (!config.usccb.cacheEnabled) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      cacheFile(iso),
      JSON.stringify({ ...readings, parserVersion: PARSER_VERSION }, null, 2),
      'utf8',
    );
  } catch {
    /* the cache is an optimisation, never a requirement */
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

export function clearCache(iso = null) {
  try {
    if (iso) {
      fs.rmSync(cacheFile(iso), { force: true });
    } else {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
      fs.rmSync(config.usccb.cacheDir, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Manual overrides
 * ------------------------------------------------------------------ */

export function getOverride(iso) {
  const row = getDb().prepare('SELECT payload, source, updated_at FROM readings_overrides WHERE date = ?').get(iso);
  if (!row) return null;
  try {
    const payload = JSON.parse(row.payload);
    payload.source = row.source || 'manual';
    payload.overriddenAt = row.updated_at;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Save corrected readings for a date. Accepts a full readings object or a patch
 * merged onto whatever we already have (that is how the editor saves one field).
 */
export async function saveOverride(iso, patch, { merge = true } = {}) {
  assertIsoDate(iso);
  let payload = patch;

  if (merge) {
    const base = getOverride(iso) || readParsedCache(iso) || emptyReadings(iso, 'manual');
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

  getDb()
    .prepare(
      `INSERT INTO readings_overrides (date, payload, source, updated_at)
       VALUES (@date, @payload, @source, datetime('now'))
       ON CONFLICT(date) DO UPDATE SET
         payload = excluded.payload, source = excluded.source, updated_at = datetime('now')`,
    )
    .run({ date: iso, payload: JSON.stringify(payload), source: payload.source });

  return payload;
}

export function deleteOverride(iso) {
  return getDb().prepare('DELETE FROM readings_overrides WHERE date = ?').run(iso).changes > 0;
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

function resolveProviderOrder(requested) {
  const configured = requested || getSettings().providerOrder || ['usccb'];
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
    const override = getOverride(iso);
    if (override) {
      override.warnings = auditReadings(override);
      override.fromCache = true;
      override.origin = 'override';
      return override;
    }
  }

  const order = resolveProviderOrder(providers);
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
    const cached = readParsedCache(iso);
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
      writeParsedCache(iso, readings);
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
 * How long the preferred source wants to be left alone before it is asked again,
 * in milliseconds; 0 when it may be asked now.
 *
 * Batch generation uses this to hold between dates rather than spend the rest of
 * the run on the fallback feed - see batchService.
 */
export function preferredCooldownMs(requested = null) {
  const provider = PROVIDERS[resolveProviderOrder(requested)[0]];
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
  getOverride,
  saveOverride,
  deleteOverride,
  importFromHtml,
  clearCache,
  providerStatus,
};
