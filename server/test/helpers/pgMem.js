/**
 * An in-process PostgreSQL for the tests.
 *
 * pg-mem runs the real `db/schema.sql` and speaks enough of the wire protocol
 * for the `pg` client, so the migration is tested against the schema that ships
 * rather than against a mock of it. It is not PostgreSQL: it is close enough to
 * catch the mistakes that matter here - wrong placeholders, a forgotten
 * `RETURNING`, JSONB that is still being hand-serialised, an upsert that does
 * not upsert - and not close enough to prove anything about performance or
 * locking.
 *
 * Two builtins the schema uses are missing from pg-mem and are registered here.
 * If a test passes only because of one of these, that is a bug in the test, not
 * a finding about PostgreSQL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { newDb, DataType } from 'pg-mem';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.resolve(HERE, '..', '..', 'db', 'schema.sql');
const SEED = path.resolve(HERE, '..', '..', 'db', 'seed.sql');

/**
 * The parish every test works in.
 *
 * This is the SAME id `db/seed.sql` gives its demo parish, and that is the whole
 * point: the seed file's rows and the tests' queries have to be about one
 * parish, or a seeded test asks about an empty one and every cascade assertion
 * fails for a reason that has nothing to do with the cascade.
 */
export const TEST_ORG_ID = '00000000-0000-4000-8000-0000000000de';

/**
 * A fresh database with the real schema applied, holding one parish.
 *
 * Multi-parish scoping means `org_id` is NOT NULL on every table a parish owns,
 * so a test fixture needs a parish to exist before it can insert anything. The
 * id is fixed rather than generated: a test that asserts on scoping is clearer
 * when the parish it is scoped to is a constant you can read.
 *
 * @param {{ seed?: boolean }} options
 * @returns {Promise<{ pool: import('pg').Pool, orgId: string, end: () => Promise<void> }>}
 */
export async function makeTestDb({ seed = false } = {}) {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  // `text ~ text` - the regex match used by the fixed_date CHECK constraint.
  db.public.registerOperator({
    operator: '~',
    left: DataType.text,
    right: DataType.text,
    returns: DataType.bool,
    implementation: (value, pattern) =>
      value == null || pattern == null ? null : new RegExp(pattern).test(value),
  });

  // gen_random_uuid - the default on organizations.id. pg-mem ships no uuid
  // functions at all, so without this the schema cannot even be created.
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: () => randomUUID(),
  });

  // char_length / length - used by the title and label CHECK constraints.
  for (const name of ['char_length', 'length']) {
    db.public.registerFunction({
      name,
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value) => (value == null ? null : value.length),
    });
  }

  db.public.none(fs.readFileSync(SCHEMA, 'utf8'));
  if (seed) db.public.none(fs.readFileSync(SEED, 'utf8'));

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  // The one parish. `seed: true` means db/seed.sql already created it, so this
  // is a no-op there and the only path that creates it when seeding is off.
  await pool.query(
    `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test Parish', 'demo-parish')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_ORG_ID],
  );

  return {
    pool,
    orgId: TEST_ORG_ID,
    async end() {
      await pool.end();
    },
  };
}

export default makeTestDb;
