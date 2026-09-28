/**
 * A real PostgreSQL for the tests, when one is reachable.
 *
 * The suite runs against pg-mem by default: in-process, no Docker, nothing to
 * install in CI. pg-mem is close enough to catch the mistakes that matter -
 * wrong placeholders, a missing RETURNING, JSONB still being hand-serialised -
 * but it is an imitation, and three things it gets wrong are documented in
 * docs/07-postgres-migration-map.md. The most important is that it accepts
 * ROLLBACK and then ignores it.
 *
 * Set TEST_DATABASE_URL and these run against the real thing:
 *
 *   docker compose up -d db
 *   TEST_DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/liturgygen \
 *     npm run test:server
 *
 * Without it they skip, so a clean checkout and CI stay green.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.resolve(HERE, '..', '..', 'db', 'schema.sql');
const SEED = path.resolve(HERE, '..', '..', 'db', 'seed.sql');

export const REAL_PG_URL = process.env.TEST_DATABASE_URL || null;

/** A reason string for node:test's `skip`, or false when a database is set. */
export const needsRealPg = REAL_PG_URL
  ? false
  : 'set TEST_DATABASE_URL to run this against a real PostgreSQL';

/**
 * A pool on a freshly rebuilt schema. Every table is dropped and recreated, so
 * these tests never inherit state - and never run against anything but the
 * throwaway database named in TEST_DATABASE_URL.
 */
export async function makeRealDb({ seed = false } = {}) {
  const pool = new pg.Pool({ connectionString: REAL_PG_URL, max: 4 });

  await pool.query(`
    DROP TABLE IF EXISTS potf_templates, readings_overrides, settings, scheduled_masses CASCADE;
  `);
  await pool.query(fs.readFileSync(SCHEMA, 'utf8'));
  if (seed) await pool.query(fs.readFileSync(SEED, 'utf8'));

  return {
    pool,
    async end() {
      await pool.end();
    },
  };
}

export default makeRealDb;
