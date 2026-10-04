/**
 * Copying one parish's prayer library into another, inside the database.
 *
 * This is the demo-critical path and it has no other coverage. `data/orillo` is
 * git-ignored, so a deployed host has never had the office's transcriptions and
 * every parish founded there got placeholders alone - two live parishes with 19
 * placeholders each and not one real prayer. Committing the book is the one
 * thing `seeds/orillo.seed.js` forbids, so the prayers are loaded into one
 * parish and every later parish is filled from it by `INSERT ... SELECT`.
 *
 * If that statement's column list drifts from the schema it fails at run time,
 * at the moment somebody founds a parish. So it gets a test.
 *
 *   npm run test:server
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { makeTestDb, TEST_ORG_ID } from './helpers/pgMem.js';
import { useTestPool, query } from '../src/db/index.js';

const { pool } = await makeTestDb();
useTestPool(pool);

const { seedPotfTemplates, cloneLibrary, clearSeeded } = await import('../src/db/seed.js');

await seedPotfTemplates({ orgId: TEST_ORG_ID });

/** A second parish, as founding one would make. */
async function newParish(name) {
  const id = randomUUID();
  await query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [
    id,
    name,
    `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${id.slice(0, 8)}`,
  ]);
  return id;
}

const countFor = async (orgId) => {
  const { rows } = await query('SELECT count(*)::int AS n FROM potf_templates WHERE org_id = $1', [orgId]);
  return rows[0].n;
};

test('the clone copies every prayer and lands them in the right parish', async () => {
  const source = await countFor(TEST_ORG_ID);
  assert.ok(source > 0, 'the source parish has prayers to copy');

  const target = await newParish('Saint Test');
  assert.equal(await countFor(target), 0, 'a new parish starts empty');

  const { copied } = await cloneLibrary(target, TEST_ORG_ID);
  assert.equal(copied, source);
  assert.equal(await countFor(target), source);
  // The source must be untouched: this is a copy, not a move.
  assert.equal(await countFor(TEST_ORG_ID), source);
});

test('the copies carry their own parish, not the source one', async () => {
  const target = await newParish('Saint Scope');
  await cloneLibrary(target, TEST_ORG_ID);
  const { rows } = await query(
    'SELECT count(*)::int AS n FROM potf_templates WHERE org_id = $1 AND title IS NOT NULL',
    [target],
  );
  assert.ok(rows[0].n > 0);
});

test('cloning into the source itself is refused, so nothing is doubled', async () => {
  const before = await countFor(TEST_ORG_ID);
  const { copied } = await cloneLibrary(TEST_ORG_ID, TEST_ORG_ID);
  assert.equal(copied, 0);
  assert.equal(await countFor(TEST_ORG_ID), before);
});

test('a re-clone replaces the seeded rows instead of doubling them', async () => {
  const source = await countFor(TEST_ORG_ID);
  const target = await newParish('Saint Twice');

  await cloneLibrary(target, TEST_ORG_ID);
  const { removed } = await clearSeeded(target);
  assert.equal(removed, source, 'everything copied was seeded, so all of it clears');
  await cloneLibrary(target, TEST_ORG_ID);

  assert.equal(await countFor(target), source, 'still one library, not two');
});

test("clearing seeded rows leaves a parish's own prayers alone", async () => {
  const target = await newParish('Saint Typed');
  await cloneLibrary(target, TEST_ORG_ID);

  // A prayer the office typed in: origin is not 'seed', so it is theirs.
  await query(
    `INSERT INTO potf_templates (org_id, title, season, priest_invitation, response_options,
                                 intentions, priest_conclusion, origin)
     VALUES ($1, 'Ours', 'ORDINARY_TIME', 'Let us pray.', '[]'::jsonb, '[]'::jsonb, 'Amen', 'manual')`,
    [target],
  );

  await clearSeeded(target);
  const { rows } = await query('SELECT title FROM potf_templates WHERE org_id = $1', [target]);
  assert.deepEqual(rows.map((row) => row.title), ['Ours']);
});
