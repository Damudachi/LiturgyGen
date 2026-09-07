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

router.get('/schedule', (req, res) => {
  const { from, to } = req.query;
  const clauses = [];
  const params = {};
  if (isIsoDate(from)) {
    clauses.push('date >= @from');
    params.from = from;
  }
  if (isIsoDate(to)) {
    clauses.push('date <= @to');
    params.to = to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb().prepare(`SELECT * FROM scheduled_masses ${where} ORDER BY date`).all(params);
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
