/**
 * The PostgreSQL layer, tested against the real `db/schema.sql`.
 *
 * pg-mem runs that schema in-process and speaks the `pg` client's protocol, so
 * these exercise the shipped SQL rather than a mock of it. What they are good
 * for: placeholders, RETURNING, JSONB round-trips, booleans, null-safe
 * matching, upserts, transactions. What they cannot tell you: anything about
 * locking, concurrency or performance on a real server.
 *
 * Every test gets its own database, so nothing leaks between them.
 */

import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { makeTestDb, TEST_ORG_ID } from './helpers/pgMem.js';
import {
  DEFAULT_SETTINGS,
  getSettings,
  isoFromDb,
  query,
  resetPool,
  setSettings,
  useTestPool,
  withTransaction,
} from '../src/db/index.js';
import * as potf from '../src/services/potfService.js';

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

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

test('settings come back as real JS values, not JSON strings', async () => {
  const settings = await getSettings(TEST_ORG_ID);
  // JSONB. The SQLite version stored these as TEXT and JSON.parse'd every row.
  assert.equal(typeof settings.includeGospel, 'boolean');
  assert.equal(settings.font, 'Book Antiqua');
  assert.deepEqual(settings.providerOrder, ['usccb', 'evangelizo']);
  assert.ok(Array.isArray(settings.schoolWideIntentions));
});

test('unset settings fall back to the defaults', async () => {
  await query('DELETE FROM settings');
  assert.deepEqual(await getSettings(TEST_ORG_ID), DEFAULT_SETTINGS);
});

test('saving a setting merges rather than replacing', async () => {
  const after = await setSettings(TEST_ORG_ID, { font: 'Georgia' });
  assert.equal(after.font, 'Georgia');
  // Everything else survives.
  assert.equal(after.separatePages, DEFAULT_SETTINGS.separatePages);
  assert.deepEqual(after.providerOrder, DEFAULT_SETTINGS.providerOrder);
});

test('saving an array setting round-trips through JSONB', async () => {
  const intentions = ['For our patron', 'For the sick of the school'];
  const after = await setSettings(TEST_ORG_ID, { schoolWideIntentions: intentions });
  assert.deepEqual(after.schoolWideIntentions, intentions);
  assert.deepEqual((await getSettings(TEST_ORG_ID)).schoolWideIntentions, intentions);
});

test('an empty patch writes nothing and still returns the settings', async () => {
  assert.equal((await setSettings(TEST_ORG_ID, {})).font, 'Book Antiqua');
});

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */

/*
 * pg-mem's pg adapter accepts BEGIN / COMMIT / ROLLBACK and then ignores them:
 * a rolled-back INSERT is still there afterwards. So the ROLLBACK actually
 * undoing the work is the one thing in this file that only a real PostgreSQL
 * can confirm, and `npm run db:reset` against a live database is where that
 * gets checked.
 *
 * What is worth testing here is the part that is mine: that withTransaction
 * issues the right commands in the right order, and - the bug that actually
 * bites - that it always releases the client. A client that is never released
 * is a connection the pool never gets back, and a free tier allows about five.
 */
function recordingPool() {
  const commands = [];
  let released = 0;
  return {
    commands,
    get released() { return released; },
    async connect() {
      return {
        async query(text) {
          commands.push(String(text).trim().split(/\s+/)[0].toUpperCase());
          if (text === 'BOOM') throw new Error('query failed');
          return { rows: [], rowCount: 0 };
        },
        release() { released += 1; },
      };
    },
  };
}

test('a successful transaction is BEGIN, the work, COMMIT - and releases the client', async () => {
  const fake = recordingPool();
  useTestPool(fake);

  const result = await withTransaction(async (client) => {
    await client.query('INSERT INTO scheduled_masses DEFAULT VALUES');
    return 'done';
  });

  assert.equal(result, 'done');
  assert.deepEqual(fake.commands, ['BEGIN', 'INSERT', 'COMMIT']);
  assert.equal(fake.released, 1);
});

test('a failing transaction rolls back, rethrows, and still releases the client', async () => {
  const fake = recordingPool();
  useTestPool(fake);

  await assert.rejects(
    withTransaction(async (client) => {
      await client.query('INSERT INTO scheduled_masses DEFAULT VALUES');
      throw new Error('something went wrong halfway');
    }),
    /something went wrong halfway/,
  );

  assert.deepEqual(fake.commands, ['BEGIN', 'INSERT', 'ROLLBACK']);
  assert.equal(fake.released, 1, 'the client must go back to the pool even on failure');
});

/* ------------------------------------------------------------------ *
 * Dates - the timezone trap
 * ------------------------------------------------------------------ */

test('isoFromDb never shifts a date', () => {
  // A DATE has no time in it, so no timezone may be applied to one. The API
  // host runs UTC and the office is UTC+8; reading a Date with LOCAL getters
  // would land a day early and print the wrong day's readings.
  assert.equal(isoFromDb('2026-09-08'), '2026-09-08');
  assert.equal(isoFromDb('2026-09-08T00:00:00.000Z'), '2026-09-08');
  assert.equal(isoFromDb(new Date('2026-09-08T00:00:00Z')), '2026-09-08');
  assert.equal(isoFromDb(null), null);
});

test('a date survives a write and a read unchanged', async () => {
  await query(
    'INSERT INTO scheduled_masses (org_id, date, label) VALUES ($1, $2, $3)',
    [TEST_ORG_ID, '2026-01-01', 'New Year'],
  );
  const { rows } = await query(
    'SELECT date FROM scheduled_masses WHERE org_id = $1 AND label = $2',
    [TEST_ORG_ID, 'New Year'],
  );
  assert.equal(isoFromDb(rows[0].date), '2026-01-01');
});

/* ------------------------------------------------------------------ *
 * Prayer templates
 * ------------------------------------------------------------------ */

const SAMPLE = {
  title: 'Test prayer',
  season: 'Advent',
  week: 2,
  dayOfWeek: 'Monday',
  priestInvitation: 'Let us pray.',
  responseOptions: ['Lord, hear our prayer.'],
  intentions: ['For the Church.', 'For the world.'],
  priestConclusion: 'Through Christ our Lord.',
};

test('createTemplate returns the row without a second query', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  // RETURNING * replaces lastInsertRowid, which PostgreSQL does not have.
  assert.ok(Number.isInteger(created.id));
  assert.equal(created.title, 'Test prayer');
  assert.deepEqual(created.intentions, SAMPLE.intentions);
  assert.equal(created.isActive, true, 'is_active is a BOOLEAN now, not 1');
  assert.equal(created.isPlaceholder, false);
});

test('arrays round-trip through JSONB without hand-serialising', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  const read = await potf.getTemplate(TEST_ORG_ID, created.id);
  assert.deepEqual(read.responseOptions, SAMPLE.responseOptions);
  assert.deepEqual(read.intentions, SAMPLE.intentions);
  assert.equal(Array.isArray(read.intentions), true);
});

test('getTemplate returns null for an id that is not there', async () => {
  assert.equal(await potf.getTemplate(TEST_ORG_ID, 999999), null);
});

test('updateTemplate changes only what it was given', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  const updated = await potf.updateTemplate(TEST_ORG_ID, created.id, { title: 'Renamed' });
  assert.equal(updated.title, 'Renamed');
  assert.equal(updated.season, 'Advent', 'untouched columns keep their values');
  assert.deepEqual(updated.intentions, SAMPLE.intentions);
});

test('updateTemplate can replace a JSONB array', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  const updated = await potf.updateTemplate(TEST_ORG_ID, created.id, { intentions: ['Only one now.'] });
  assert.deepEqual(updated.intentions, ['Only one now.']);
});

test('editing a placeholder clears the placeholder flag', async () => {
  // Rewriting a placeholder's text makes it the office's own prayer.
  const { rows } = await query(
    'SELECT id FROM potf_templates WHERE is_placeholder ORDER BY id LIMIT 1',
  );
  const updated = await potf.updateTemplate(TEST_ORG_ID, rows[0].id, { priestInvitation: 'My own words.' });
  assert.equal(updated.isPlaceholder, false);
});

test('deleteTemplate reports whether anything was deleted', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  assert.equal(await potf.deleteTemplate(TEST_ORG_ID, created.id), true);
  // rowCount, because better-sqlite3's `.changes` does not exist here.
  assert.equal(await potf.deleteTemplate(TEST_ORG_ID, created.id), false);
});

test('duplicateTemplate copies the text and keeps a placeholder a placeholder', async () => {
  const { rows } = await query(
    'SELECT id, title FROM potf_templates WHERE is_placeholder ORDER BY id LIMIT 1',
  );
  const copy = await potf.duplicateTemplate(TEST_ORG_ID, rows[0].id);
  assert.equal(copy.title, `${rows[0].title} (copy)`);
  assert.equal(copy.isPlaceholder, true, 'a copy is still the placeholder text until edited');
});

/* ------------------------------------------------------------------ *
 * Listing and search
 * ------------------------------------------------------------------ */

test('listTemplates hides inactive rows unless asked', async () => {
  const created = await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  await potf.updateTemplate(TEST_ORG_ID, created.id, { isActive: false });

  const visible = await potf.listTemplates(TEST_ORG_ID);
  assert.equal(visible.some((t) => t.id === created.id), false);

  const all = await potf.listTemplates(TEST_ORG_ID, { includeInactive: true });
  assert.equal(all.some((t) => t.id === created.id), true);
});

test('search is case-insensitive', async () => {
  // PostgreSQL's LIKE is case-sensitive where SQLite's was not, so this is
  // ILIKE now. Without that change, searching "advent" found nothing.
  await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  const lower = await potf.listTemplates(TEST_ORG_ID, { search: 'test prayer' });
  const upper = await potf.listTemplates(TEST_ORG_ID, { search: 'TEST PRAYER' });
  assert.equal(lower.length, 1);
  assert.equal(upper.length, 1);
});

test('search reaches inside the intentions array', async () => {
  await potf.createTemplate(TEST_ORG_ID, { ...SAMPLE, intentions: ['For a very particular thing.'] });
  const found = await potf.listTemplates(TEST_ORG_ID, { search: 'very particular' });
  assert.equal(found.length, 1);
});

test('filtering by season narrows the list', async () => {
  await potf.createTemplate(TEST_ORG_ID, SAMPLE);
  const advent = await potf.listTemplates(TEST_ORG_ID, { season: 'Advent' });
  assert.ok(advent.length >= 1);
  assert.ok(advent.every((t) => t.season === 'Advent'));
});

/* ------------------------------------------------------------------ *
 * The cascade
 * ------------------------------------------------------------------ */

test('the cascade prefers a celebration over a weekday match', async () => {
  await potf.createTemplate(TEST_ORG_ID, {
    ...SAMPLE, title: 'Weekday one', celebrationId: null,
  });
  await potf.createTemplate(TEST_ORG_ID, {
    ...SAMPLE, title: 'Celebration one', week: null, dayOfWeek: null, celebrationId: 'st_nicholas',
  });

  const resolved = await potf.resolveForDay(TEST_ORG_ID, {
    season: 'Advent', week: 2, dayOfWeek: 'Monday', celebrationId: 'st_nicholas',
    availableCelebrationIds: ['st_nicholas'],
  });
  assert.equal(resolved.template.title, 'Celebration one');
  assert.match(resolved.matchedBy, /celebration/i);
});

test('the cascade matches a fixed calendar date', async () => {
  await potf.createTemplate(TEST_ORG_ID, {
    ...SAMPLE, title: 'The nineteenth', week: null, dayOfWeek: null, fixedDate: '12-19',
  });
  const resolved = await potf.resolveForDay(TEST_ORG_ID, { season: 'Advent', fixedDate: '12-19' });
  assert.equal(resolved.template.title, 'The nineteenth');
});

test('a day with nothing matching resolves to no prayer at all', async () => {
  // Not to a placeholder. The office should never print a prayer they did not
  // choose, so an unmatched day prints nothing and the document says so.
  const resolved = await potf.resolveForDay(TEST_ORG_ID, { season: 'Advent', week: 4, dayOfWeek: 'Friday' });
  assert.equal(resolved.template, null);
  assert.equal(resolved.matchedBy, 'none');
});

test('placeholders are reachable only when explicitly allowed', async () => {
  const lookup = { season: 'Ordinary Time', week: 9, dayOfWeek: 'Tuesday' };
  assert.equal((await potf.resolveForDay(TEST_ORG_ID, lookup)).template, null);

  const allowed = await potf.resolveForDay(TEST_ORG_ID, lookup, { allowPlaceholders: true });
  assert.ok(allowed.template, 'the seeded Ordinary Time placeholder should be found');
  assert.equal(allowed.template.isPlaceholder, true);
});

test('resolveForDay tolerates a missing lookup', async () => {
  assert.deepEqual(await potf.resolveForDay(TEST_ORG_ID, null), { template: null, matchedBy: 'none' });
});
