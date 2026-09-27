/**
 * The Express application: middleware, routes, error handling.
 *
 * Creating the app and listening on a port are kept apart on purpose. This file
 * exports an app that tests can drive without opening a socket; `server.js` at
 * the root of this workspace is the entry point that actually listens.
 */

import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config, { ROOT } from './config.js';
import calendarRoutes from './routes/calendar.js';
import readingsRoutes from './routes/readings.js';
import generateRoutes from './routes/generate.js';
import batchRoutes from './routes/batch.js';
import potfRoutes from './routes/potf.js';
import settingsRoutes from './routes/settings.js';
import { checkDatabase } from './db/index.js';
import basicAuth, { gateEnabled } from './middleware/basicAuth.js';

/**
 * CORS goes on before the routes: middleware registered after a route never
 * sees that route's requests.
 *
 * The origins are named rather than left open. `cors()` with no options sends
 * `Access-Control-Allow-Origin: *`, which lets any site on the internet call
 * this API from a visitor's browser. The installed desktop build serves the
 * client from this same process, so it needs no entry here; the list is for the
 * development server and for a deployed client on a different origin.
 */
export function allowedOrigins() {
  return (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();

  app.use(cors({ origin: allowedOrigins() }));
  app.use(express.json({ limit: '25mb' })); // a saved USCCB page is ~60 KB; imports may be batched
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  /**
   * Is the process alive? Nothing here touches the database, so a host's health
   * check does not fail because of a sleeping database.
   */
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'LiturgyGen' });
  });

  /**
   * Is the database reachable? A different question from /healthz, and the one
   * that tells you in two seconds which half of a problem you have.
   */
  app.get('/readyz', async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ ok: true, db: 'up' });
    } catch (error) {
      console.error('readyz failed:', error.message);
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  /**
   * The door. Everything below this line is behind it; everything above -
   * /healthz and /readyz - is deliberately not, because a host's health check
   * cannot authenticate and a gated one gets the service marked unhealthy and
   * killed. Neither leaks anything: one says the process is alive, the other
   * says whether the database answered.
   *
   * Off when BASIC_AUTH_USER and BASIC_AUTH_PASS are unset, so development and
   * the desktop build are unaffected. See src/middleware/basicAuth.js.
   */
  app.use(basicAuth({ realm: 'LiturgyGen' }));

  /** Kept for the client's own boot check, which reports the live settings. */
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'LiturgyGen',
      calendar: config.calendar.particularCalendar,
      readingsDelayMs: config.usccb.delayMs,
    });
  });

  app.use('/api/calendar', calendarRoutes);
  app.use('/api/readings', readingsRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/batch', batchRoutes);
  app.use('/api/potf', potfRoutes);
  app.use('/api/settings', settingsRoutes);

  // Serve the built client when it exists, so `npm start` runs the whole app.
  // A deployed API host has no client build beside it and simply skips this.
  const clientDist = path.join(ROOT, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/(api|healthz|readyz)\b).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((_req, res) => res.status(404).json({ error: 'No such route.' }));

  // The detail goes to the log; the caller gets a plain message. Sending a
  // stack trace to a stranger describes your file layout and dependencies.
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: status >= 500 && process.env.NODE_ENV === 'production'
        ? 'Something went wrong on the server.'
        : error.message || 'Something went wrong.',
      code: error.code,
      ...(error.attempts ? { attempts: error.attempts } : {}),
    });
  });

  return app;
}

export default createApp;
