import { Router } from 'express';
import { DEFAULT_SETTINGS, getSettings, isoFromDb, query, setSettings, withTransaction } from '../db/index.js';
import { isIsoDate, sortUnique } from '../lib/dates.js';
import { DEFAULT_STYLE } from '../services/docxService.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings(req.orgId), defaults: DEFAULT_SETTINGS, style: DEFAULT_STYLE });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const patch = req.body || {};
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const unknown = Object.keys(patch).filter((key) => !allowed.includes(key));
    if (unknown.length) {
      return res.status(400).json({ error: `Unknown setting(s): ${unknown.join(', ')}` });
    }
    res.json({ settings: await setSettings(req.orgId, patch) });
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
  none: { text: 'SELECT * FROM scheduled_masses ORDER BY date', values: () => [] },
  from: { text: 'SELECT * FROM scheduled_masses WHERE date >= $1 ORDER BY date', values: (f) => [f] },
  to: { text: 'SELECT * FROM scheduled_masses WHERE date <= $1 ORDER BY date', values: (_f, t) => [t] },
  both: {
    text: 'SELECT * FROM scheduled_masses WHERE date >= $1 AND date <= $2 ORDER BY date',
    values: (f, t) => [f, t],
  },
};

router.get('/schedule', async (req, res, next) => {
  const from = isIsoDate(req.query.from) ? req.query.from : null;
  const to = isIsoDate(req.query.to) ? req.query.to : null;
  const chosen = SCHEDULE_QUERIES[from && to ? 'both' : from ? 'from' : to ? 'to' : 'none'];

  try {
    const { rows } = await query(chosen.text, chosen.values(from, to));
    // `date` is a DATE column. isoFromDb keeps it a plain 'YYYY-MM-DD' string
    // all the way out to the client, which is what every other date in this
    // API already is.
    res.json({ scheduled: rows.map((row) => ({ ...row, date: isoFromDb(row.date) })) });
  } catch (error) {
    next(error);
  }
});

router.post('/schedule', async (req, res, next) => {
  const { dates, label = null, notes = null } = req.body || {};
  const list = sortUnique(Array.isArray(dates) ? dates : [dates]).filter(isIsoDate);
  if (!list.length) return res.status(400).json({ error: 'Provide one or more dates as YYYY-MM-DD.' });

  try {
    // All the dates or none of them. `ON CONFLICT ... DO UPDATE` is the same
    // syntax PostgreSQL and SQLite share, so this clause ported unchanged.
    await withTransaction(async (client) => {
      for (const date of list) {
        await client.query(
          `INSERT INTO scheduled_masses (date, label, notes) VALUES ($1, $2, $3)
           ON CONFLICT (date) DO UPDATE SET label = excluded.label, notes = excluded.notes`,
          [date, label, notes],
        );
      }
    });
    res.status(201).json({ added: list });
  } catch (error) {
    next(error);
  }
});

router.delete('/schedule/:date', async (req, res, next) => {
  if (!isIsoDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  try {
    const { rowCount } = await query('DELETE FROM scheduled_masses WHERE date = $1', [req.params.date]);
    res.json({ deleted: rowCount > 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
