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
import { newDb, DataType } from 'pg-mem';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.resolve(HERE, '..', '..', 'db', 'schema.sql');
const SEED = path.resolve(HERE, '..', '..', 'db', 'seed.sql');

/**
 * A fresh database with the real schema applied.
 * @param {{ seed?: boolean }} options
 * @returns {Promise<{ pool: import('pg').Pool, end: () => Promise<void> }>}
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
  return {
    pool,
    async end() {
      await pool.end();
    },
  };
}

export default makeTestDb;
