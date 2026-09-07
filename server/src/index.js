import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config, { ROOT } from './config.js';
import { getDb } from './db/index.js';
import { seedPotfTemplates } from './db/seed.js';
import calendarRoutes from './routes/calendar.js';
import readingsRoutes from './routes/readings.js';
import generateRoutes from './routes/generate.js';
import batchRoutes from './routes/batch.js';
import potfRoutes from './routes/potf.js';
import settingsRoutes from './routes/settings.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '25mb' })); // a saved USCCB page is ~60 KB; imports may be batched
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

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
  const clientDist = path.join(ROOT, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: error.message || 'Something went wrong.',
      code: error.code,
      ...(error.attempts ? { attempts: error.attempts } : {}),
    });
  });

  return app;
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/index.js');

if (isDirectRun) {
  getDb();
  const seeded = seedPotfTemplates();
  if (seeded.inserted) {
    console.log(`Seeded ${seeded.inserted} Prayers of the Faithful templates.`);
  }

  createApp().listen(config.port, () => {
    console.log(`LiturgyGen API listening on http://localhost:${config.port}`);
    console.log(`  calendar   : ${config.calendar.particularCalendar}`);
    console.log(`  database   : ${config.dbFile}`);
    console.log(`  scrape gap : ${config.usccb.delayMs} ms between requests`);
  });
}

export default createApp;
