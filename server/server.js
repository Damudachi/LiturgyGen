/**
 * The entry point. Starts the API and, when a client build is sitting beside
 * it, serves that too.
 *
 *   npm run dev     watch mode, reads .env
 *   npm start       production
 *
 * The application itself is built in src/app.js, which is importable without
 * opening a socket.
 */

import config from './src/config.js';
import createApp, { allowedOrigins } from './src/app.js';
import { authConfigured } from './src/middleware/requireAuth.js';
import { checkDatabase } from './src/db/index.js';
import { seedPotfTemplates } from './src/db/seed.js';

/** Host and database name from DATABASE_URL, with the password left out. */
function databaseLabel() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return 'not configured';
  }
}

/*
 * Fail here rather than on the first request. `npm run db:schema` has to have
 * been run against DATABASE_URL at least once; there is no migrations array in
 * JavaScript any more, so the process does not create its own tables.
 */
try {
  await checkDatabase();
} catch (error) {
  console.error(`Cannot reach the database: ${error.message}`);
  console.error('Check DATABASE_URL, and run `npm run db:reset` if the schema has never been applied.');
  process.exit(1);
}

/*
 * Starter prayers are seeded per parish now, when a parish is founded - see
 * routes/account.js. There is no longer a single table to seed at boot, so this
 * only runs for a development checkout that pins one parish.
 */
const devOrgId = process.env.LITURGYGEN_DEV_ORG_ID;
if (devOrgId) {
  const seeded = await seedPotfTemplates({ orgId: devOrgId });
  if (seeded.inserted) {
    console.log(`Seeded ${seeded.inserted} Prayers of the Faithful templates.`);
  }
}

/**
 * The desktop launcher owns this process. If the launcher goes away without
 * stopping it - killed, or the office signed out - stop too, rather than hold
 * the port so the next launch cannot start.
 */
const parentPid = Number(process.env.LITURGYGEN_PARENT_PID);
if (parentPid) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 5000).unref();
}

// The host chooses the port and tells you through PORT. Hardcoding it is the
// commonest reason a first deploy is marked unhealthy and killed.
const port = Number(process.env.PORT || config.port);

createApp().listen(port, config.host, () => {
  console.log(`LiturgyGen API listening on http://localhost:${port}`);
  console.log(`  calendar   : ${config.calendar.particularCalendar}`);
  // The host, never the credentials. A connection string in a log is a
  // connection string in whatever collects that log.
  console.log(`  database   : ${databaseLabel()}`);
  console.log(`  scrape gap : ${config.usccb.delayMs} ms between requests`);
  console.log(`  CORS allows: ${allowedOrigins().join(', ')}`);
  // Never print the credential itself - only whether there is one. A log is
  // the commonest way a secret escapes a service that never committed one.
  console.log(`  accounts   : ${authConfigured() ? 'ON (Supabase)' : 'off (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable)'}`);
});
