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
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

  /**
   * Security headers.
   *
   * The Content-Security-Policy is written out rather than left at helmet's
   * default, because this same process serves the built client and the default
   * policy blocks it: Tailwind injects a stylesheet at run time, and the fonts
   * are served from this origin. The policy below allows exactly that and
   * nothing else - no external scripts, no frames, no object embeds.
   *
   * `crossOriginEmbedderPolicy` is off: it buys nothing here and breaks the
   * WebView2 desktop shell.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Tailwind and the app's own inline style attributes.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          // The client only ever talks to its own origin.
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

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

  /**
   * Rate limiting, applied after the gate so a signed-in office is measured
   * separately from anonymous traffic hammering the door.
   *
   * The numbers are generous because the app is genuinely chatty: opening a
   * month fires one calendar request and one check for every chosen day, and a
   * 200-day batch polls its own progress. This is a brake on abuse, not a quota.
   * Disabled under NODE_ENV=test so the suite is not throttled.
   */
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: 600,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many requests. Wait a minute and try again.' },
      }),
    );
  }

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
