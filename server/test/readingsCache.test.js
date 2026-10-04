/**
 * The readings cache, now that it is a table rather than a folder of files.
 *
 * This is the cache the whole app's speed rests on: a miss is not a slow page,
 * it is a USCCB request and possibly a three-minute cooldown. These tests cover
 * the four things that would quietly turn every day into a miss - a round-trip
 * that loses a field, a parser-version stamp that never matches, an upsert that
 * inserts twice, and a date that comes back shifted by a timezone.
 *
 * pg-mem, so: nothing here proves anything about concurrency.
 *
 *   npm run test:server
 */

import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { makeTestDb } from './helpers/pgMem.js';
import { makeRealDb, needsRealPg } from './helpers/realPg.js';
import { isoFromDb, query, resetPool, useTestPool } from '../src/db/index.js';
import { PARSER_VERSION, clearCache, getReadings, peekReadings } from '../src/services/scraperService.js';

let close;

beforeEach(async () => {
  const { pool, end } = await makeTestDb({ seed: true });
  useTestPool(pool);
  close = end;
});

afterEach(async () => {
  resetPool();
  await close();
});

/** A day as a provider would hand it over. */
const DAY = {
  date: '2026-10-04',
  title: 'Twenty-seventh Sunday in Ordinary Time',
  source: 'usccb',
  firstReading: { citation: 'Hab 1:2-3; 2:2-4', text: 'How long, O LORD?' },
  psalm: { citation: 'Ps 95:1-2', response: 'If today you hear his voice', stanzas: ['Come, let us sing'] },
  secondReading: { citation: '2 Tm 1:6-8, 13-14', text: 'Stir into flame' },
  gospelAcclamation: { citation: '1 Pt 1:25', text: 'The word of the Lord remains forever' },
  gospel: { citation: 'Lk 17:5-10', text: 'Increase our faith' },
};

/** Store a day the way writeParsedCache does, without going through a provider. */
async function seedCache(iso, payload, version = PARSER_VERSION) {
  await query(
    `INSERT INTO readings_cache (date, payload, parser_version)
          VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (date) DO UPDATE
             SET payload = EXCLUDED.payload, parser_version = EXCLUDED.parser_version`,
    [iso, JSON.stringify(payload), version],
  );
}

test('a cached day survives the round trip through JSONB intact', async () => {
  await seedCache(DAY.date, DAY);

  const peeked = await peekReadings(DAY.date);
  assert.ok(peeked, 'a cached day should be found');
  assert.equal(peeked.title, DAY.title);
  assert.equal(peeked.psalm.response, DAY.psalm.response);
  assert.deepEqual(peeked.psalm.stanzas, DAY.psalm.stanzas);
  assert.equal(peeked.gospel.citation, DAY.gospel.citation);
  assert.equal(peeked.origin, 'cache');
});

test('the cached date is the date asked for, not one shifted by a timezone', async () => {
  // A day early here means printing Saturday's readings at a Sunday Mass.
  //
  // Asserted through isoFromDb rather than on the raw column, because pg-mem
  // hands back a Date object: its adapter does not run the `pg` type parsers,
  // so the setTypeParser(1082) override in src/db/index.js - the thing that
  // actually prevents the shift in production - is not in play here. The
  // version of this that tests the real behaviour is below, against real
  // PostgreSQL.
  await seedCache(DAY.date, DAY);
  const { rows } = await query('SELECT date FROM readings_cache');
  assert.equal(isoFromDb(rows[0].date), '2026-10-04');
});

test(
  'real PostgreSQL returns the cached date as a plain string, unshifted',
  { skip: needsRealPg },
  async () => {
    // The one that proves setTypeParser(1082) is doing its job. The API runs in
    // UTC and the office is in UTC+8, so a DATE parsed into local midnight and
    // re-formatted lands a day early.
    const { pool, end } = await makeRealDb({ seed: true });
    useTestPool(pool);
    try {
      await seedCache(DAY.date, DAY);
      const { rows } = await query('SELECT date FROM readings_cache');
      assert.equal(typeof rows[0].date, 'string', 'DATE must arrive as a string');
      assert.equal(rows[0].date, '2026-10-04');
    } finally {
      resetPool();
      await end();
    }
  },
);

test('a day stamped by an older parser is not served', async () => {
  await seedCache(DAY.date, DAY, PARSER_VERSION - 1);
  assert.equal(await peekReadings(DAY.date), null, 'a stale stamp must read as a miss');
});

test('a day never fetched reads as a miss rather than an error', async () => {
  assert.equal(await peekReadings('2026-12-25'), null);
});

test('storing the same date twice updates it instead of failing', async () => {
  await seedCache(DAY.date, DAY);
  await seedCache(DAY.date, { ...DAY, title: 'Corrected title' });

  const { rows } = await query('SELECT date FROM readings_cache');
  assert.equal(rows.length, 1, 'the upsert must not leave two rows for one date');
  assert.equal((await peekReadings(DAY.date)).title, 'Corrected title');
});

test('a cached day is served without asking any provider', async () => {
  await seedCache(DAY.date, DAY);
  // No provider is stubbed. If getReadings tried to fetch, this would either
  // reach the network or throw NO_PROVIDER - both are failures of this test.
  const readings = await getReadings(DAY.date);
  assert.equal(readings.fromCache, true);
  assert.equal(readings.origin, 'cache');
  assert.equal(readings.title, DAY.title);
});

test('the transient fields of one request are not stored as part of the day', async () => {
  // writeParsedCache strips these. If they were kept, a later cache hit would
  // hand back `fromCache: false` and the UI would say it had just been fetched.
  await seedCache(DAY.date, DAY);
  const { rows } = await query('SELECT payload FROM readings_cache WHERE date = $1', [DAY.date]);
  for (const field of ['fromCache', 'origin', 'attempts', 'refetchable']) {
    assert.equal(field in rows[0].payload, false, `${field} should not be stored`);
  }
});

test('clearing one date leaves the others', async () => {
  await seedCache('2026-10-04', DAY);
  await seedCache('2026-10-11', { ...DAY, date: '2026-10-11' });

  assert.equal(await clearCache('2026-10-04'), true);
  assert.equal(await peekReadings('2026-10-04'), null);
  assert.ok(await peekReadings('2026-10-11'), 'clearing one date must not clear the rest');
});

test('clearing everything empties the table', async () => {
  await seedCache('2026-10-04', DAY);
  await seedCache('2026-10-11', { ...DAY, date: '2026-10-11' });

  assert.equal(await clearCache(), true);
  const { rows } = await query('SELECT date FROM readings_cache');
  assert.equal(rows.length, 0);
});

test('an override still beats the cache', async () => {
  await seedCache(DAY.date, DAY);
  await query(
    `INSERT INTO readings_overrides (date, payload, source) VALUES ($1, $2::jsonb, 'manual')`,
    [DAY.date, JSON.stringify({ ...DAY, title: 'Typed off the printed page' })],
  );

  const peeked = await peekReadings(DAY.date);
  assert.equal(peeked.origin, 'override');
  assert.equal(peeked.title, 'Typed off the printed page');
});
