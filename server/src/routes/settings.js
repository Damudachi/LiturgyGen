import { Router } from 'express';
import { DEFAULT_SETTINGS, getDb, getSettings, setSettings } from '../db/index.js';
import { isIsoDate, sortUnique } from '../lib/dates.js';
import { DEFAULT_STYLE } from '../services/docxService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS, style: DEFAULT_STYLE });
});

router.put('/', (req, res, next) => {
  try {
    const patch = req.body || {};
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const unknown = Object.keys(patch).filter((key) => !allowed.includes(key));
    if (unknown.length) {
      return res.status(400).json({ error: `Unknown setting(s): ${unknown.join(', ')}` });
    }
    res.json({ settings: setSettings(patch) });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ *
 * Scheduled Masses - the office's own list of dates a batch can be built from
 * ------------------------------------------------------------------ */

/**
 * The saved Mass schedule, optionally bounded by ?from= and ?to=.
 *
 * This used to assemble its WHERE clause by joining strings. The values were
 * always bound and both inputs were validated by isIsoDate() first, so it was
 * never injectable - but a query built by concatenation is the shape a reader
 * has to stop and verify, and "it happens to be safe" is a worse property than
 * "it cannot be unsafe". Four fixed queries, chosen by which bounds are
 * present, and no SQL is built at run time at all.
 */
const SCHEDULE_QUERIES = {
  none: 'SELECT * FROM scheduled_masses ORDER BY date',
  from: 'SELECT * FROM scheduled_masses WHERE date >= @from ORDER BY date',
  to: 'SELECT * FROM scheduled_masses WHERE date <= @to ORDER BY date',
  both: 'SELECT * FROM scheduled_masses WHERE date >= @from AND date <= @to ORDER BY date',
};

router.get('/schedule', (req, res) => {
  const from = isIsoDate(req.query.from) ? req.query.from : null;
  const to = isIsoDate(req.query.to) ? req.query.to : null;

  const key = from && to ? 'both' : from ? 'from' : to ? 'to' : 'none';
  const params = { ...(from && { from }), ...(to && { to }) };

  const rows = getDb().prepare(SCHEDULE_QUERIES[key]).all(params);
  res.json({ scheduled: rows });
});

router.post('/schedule', (req, res) => {
  const { dates, label = null, notes = null } = req.body || {};
  const list = sortUnique(Array.isArray(dates) ? dates : [dates]).filter(isIsoDate);
  if (!list.length) return res.status(400).json({ error: 'Provide one or more dates as YYYY-MM-DD.' });

  const statement = getDb().prepare(`
    INSERT INTO scheduled_masses (date, label, notes) VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET label = excluded.label, notes = excluded.notes
  `);
  getDb().transaction(() => list.forEach((date) => statement.run(date, label, notes)))();
  res.status(201).json({ added: list });
});

router.delete('/schedule/:date', (req, res) => {
  if (!isIsoDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  const result = getDb().prepare('DELETE FROM scheduled_masses WHERE date = ?').run(req.params.date);
  res.json({ deleted: result.changes > 0 });
});

export default router;
