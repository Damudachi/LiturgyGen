// Run a .sql file against DATABASE_URL.
//
//   npm run db:schema          (server/.env is loaded for you)
//   node db/run.js db/schema.sql
//
// This exists instead of a psql command in package.json so the same script
// works on macOS, Windows, Linux and a Codespace, and so you do not need the
// PostgreSQL client tools installed to set up the database.

// First: the pool reads DATABASE_URL as it is imported.
import '../src/loadEnv.js';
import { readFileSync } from 'node:fs';
import { pool } from './pool.js';

const file = process.argv[2];

if (!file) {
  console.error('usage: node --env-file=.env db/run.js <file.sql>');
  process.exit(1);
}

try {
  await pool.query(readFileSync(file, 'utf8'));
  console.log(`ran ${file}`);
} catch (error) {
  console.error(`failed on ${file}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
