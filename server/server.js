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
import { gateEnabled } from './src/middleware/basicAuth.js';
import { getDb } from './src/db/index.js';
import { seedPotfTemplates } from './src/db/seed.js';

getDb();
const seeded = seedPotfTemplates();
if (seeded.inserted) {
  console.log(`Seeded ${seeded.inserted} Prayers of the Faithful templates.`);
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
  console.log(`  database   : ${config.dbFile}`);
  console.log(`  scrape gap : ${config.usccb.delayMs} ms between requests`);
  console.log(`  CORS allows: ${allowedOrigins().join(', ')}`);
  // Never print the credential itself - only whether there is one. A log is
  // the commonest way a secret escapes a service that never committed one.
  console.log(`  basic auth : ${gateEnabled() ? 'ON' : 'off (set BASIC_AUTH_USER and BASIC_AUTH_PASS to enable)'}`);
});
