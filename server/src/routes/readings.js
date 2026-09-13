import { Router } from 'express';
import { isIsoDate, sortUnique } from '../lib/dates.js';
import {
  deleteOverride,
  getOverride,
  getReadings,
  importFromHtml,
  providerStatus,
  saveOverride,
  clearCache,
} from '../services/scraperService.js';
import { buildDay, checkDay } from '../services/compositionService.js';

const router = Router();

const requireDate = (req, res) => {
  if (isIsoDate(req.params.date)) return true;
  res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  return false;
};

router.get('/providers', (_req, res) => res.json({ providers: providerStatus() }));

router.delete('/cache', (req, res) => {
  const date = req.query.date;
  res.json({ cleared: clearCache(date && isIsoDate(date) ? date : null) });
});

/**
 * What each day still needs, from what is already on hand - nothing is fetched.
 * Body: { dates: ["2026-10-01", ...] }
 */
router.post('/check', async (req, res, next) => {
  try {
    const { dates } = req.body || {};
    if (!Array.isArray(dates) || dates.some((date) => !isIsoDate(date))) {
      return res.status(400).json({ error: 'Provide "dates" as an array of YYYY-MM-DD strings.' });
    }
    const unique = sortUnique(dates);
    if (unique.length > 400) return res.status(400).json({ error: 'Check at most 400 days at a time.' });

    const days = [];
    for (const date of unique) days.push(await checkDay(date));
    res.json({ days });
  } catch (error) {
    next(error);
  }
});

/** Readings only. `?force=1` bypasses the cache and re-fetches. */
router.get('/:date', async (req, res, next) => {
  if (!requireDate(req, res)) return;
  try {
    const readings = await getReadings(req.params.date, {
      force: req.query.force === '1' || req.query.force === 'true',
    });
    res.json(readings);
  } catch (error) {
    next(error);
  }
});

/**
 * The full composed day - liturgy + readings + Prayers of the Faithful.
 * This is what the Single Date tab renders as its live preview.
 */
router.get('/:date/full', async (req, res, next) => {
  if (!requireDate(req, res)) return;
  try {
    const day = await buildDay(req.params.date, {
      force: req.query.force === '1',
      potfTemplateId: req.query.potfTemplateId ? Number(req.query.potfTemplateId) : null,
    });
    res.json(day);
  } catch (error) {
    next(error);
  }
});

/** Save a correction (a missing psalm response, a retyped line). */
router.put('/:date', async (req, res, next) => {
  if (!requireDate(req, res)) return;
  try {
    res.json(await saveOverride(req.params.date, req.body || {}, { merge: req.query.merge !== 'false' }));
  } catch (error) {
    next(error);
  }
});

router.get('/:date/override', (req, res) => {
  if (!requireDate(req, res)) return;
  const override = getOverride(req.params.date);
  if (!override) return res.status(404).json({ error: `No saved corrections for ${req.params.date}.` });
  res.json(override);
});

router.delete('/:date/override', (req, res) => {
  if (!requireDate(req, res)) return;
  res.json({ deleted: deleteOverride(req.params.date) });
});

/**
 * Import a USCCB page the user saved or copied themselves. Same parser as the
 * live fetch, so the result is identical in fidelity.
 */
router.post('/:date/import', async (req, res, next) => {
  if (!requireDate(req, res)) return;
  try {
    const { html } = req.body || {};
    res.json(await importFromHtml(req.params.date, html));
  } catch (error) {
    next(error);
  }
});

export default router;
