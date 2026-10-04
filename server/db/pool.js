/**
 * The PostgreSQL connection pool.
 *
 * `src/db/index.js` imports this lazily - lazily because the `process.exit(1)`
 * below is right for a server and wrong for a test run, which supplies its own
 * pool instead. The schema it connects to lives in db/schema.sql;
 * docs/07-postgres-migration-map.md records what each call site used to be.
 */

import pg from 'pg';

// Fail at boot with one clear line, rather than with a mystery 500 an hour
// later. The commonest deployment mistake is setting a variable in .env on your
// laptop and never setting it in the host's dashboard.
if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Locally: copy .env.example to .env and fill it in. ' +
    'On a host: add it in the dashboard, then redeploy.',
  );
  process.exit(1);
}

/**
 * A local PostgreSQL has no TLS configured. Every managed host requires it and
 * presents a certificate chain Node does not trust out of the box, which is why
 * rejectUnauthorized is false: the connection is still encrypted, it is just
 * not verifying who is on the other end. If the host publishes a CA
 * certificate, pass it as ssl: { ca: readFileSync('ca.pem') } instead.
 */
const isLocal =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5,                          // free tiers allow far fewer than you think
  idleTimeoutMillis: 10_000,       // hand connections back quickly
  connectionTimeoutMillis: 5_000,  // fail fast rather than hanging the request
});

// A pool whose server goes away should say so once, loudly, not take the
// process down.
pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error.message);
});

export default pool;
