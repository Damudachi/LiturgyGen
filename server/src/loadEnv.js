/**
 * Load `server/.env` for anything run from a terminal.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nothing in this workspace ever read `.env`. On a host that is correct and
 * deliberate - Render puts the variables in the process environment itself, and
 * there is no `.env` there to read. But it meant every command run locally
 * started with no configuration at all:
 *
 *     $ npm run seed -- --list
 *     DATABASE_URL is not set. Locally: copy .env.example to .env and fill it in.
 *
 * which is a confusing thing to be told while looking at a filled-in `.env`.
 * There is no dotenv dependency and there does not need to be: Node has read
 * these files itself since 20.6, and `process.loadEnvFile` since 21.7.
 *
 * TWO PROPERTIES THAT MATTER
 * --------------------------
 *   - **A missing file is fine.** On a host there is none, and that is the
 *     normal case rather than an error, so the throw is swallowed.
 *   - **It does not override anything already set.** That is Node's own
 *     behaviour for env files and it is the behaviour we want: a host's real
 *     environment, or a variable exported for one command, always wins over a
 *     stale `.env` left in a checkout.
 *
 * Import this FIRST in anything with a `main`. ES modules evaluate their
 * imports in declaration order, so a module listed above `./db/index.js` runs
 * before the pool reads `DATABASE_URL` - which it does at import time, not on
 * first query. Listed second, it is already too late.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(ENV_FILE);
  }
} catch {
  /* No .env, or it is unreadable. Both are normal on a host; the process
     environment is the source of truth there and the caller will say so
     plainly if something it needs is missing. */
}

export default ENV_FILE;
