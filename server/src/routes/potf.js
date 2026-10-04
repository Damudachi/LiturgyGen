import { Router } from 'express';
import potfService, { POTF_DAYS, POTF_SEASONS } from '../services/potfService.js';
import { parseOrilloPage } from '../lib/orilloParser.js';
import { isIsoDate } from '../lib/dates.js';
import { getLiturgicalDay } from '../services/calendarService.js';
import { getSettings } from '../db/index.js';

const router = Router();

router.get('/meta', (_req, res) => res.json({ seasons: POTF_SEASONS, days: POTF_DAYS }));

/**
 * Split a prayer typed straight off the printed page into its parts, without
 * saving anything - the office checks the result before it commits.
 */
router.post('/parse', (req, res, next) => {
  try {
    res.json(parseOrilloPage((req.body || {}).text));
  } catch (error) {
    next(error);
  }
});

/** Parse a typed page and save it against the day the office chose for it. */
router.post('/import', async (req, res, next) => {
  try {
    const body = req.body || {};
    const parsed = parseOrilloPage(body.text);
    const template = await potfService.createTemplate(req.orgId, {
      title: body.title || parsed.title || 'Imported prayer',
      season: body.season,
      week: body.week,
      dayOfWeek: body.dayOfWeek,
      celebrationId: body.celebrationId,
      fixedDate: body.fixedDate,
      priestInvitation: parsed.priestInvitation,
      responseOptions: parsed.responseOptions,
      intentions: parsed.intentions,
      priestConclusion: parsed.priestConclusion,
      // Left as "custom" so a later re-seed never overwrites what the office typed.
      notes: body.notes,
    });
    res.status(201).json({ template, warnings: parsed.warnings });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({
      templates: await potfService.listTemplates(req.orgId, {
        season: req.query.season,
        week: req.query.week,
        dayOfWeek: req.query.dayOfWeek,
        search: req.query.search,
        includeInactive: req.query.includeInactive === 'true',
      }),
    });
  } catch (error) {
    next(error);
  }
});

/** Which template a given date would use, and why - used by the preview pane. */
router.get('/resolve/:date', async (req, res, next) => {
  try {
    if (!isIsoDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    const liturgy = await getLiturgicalDay(req.params.date);
    const settings = await getSettings(req.orgId);
    const resolved = await potfService.resolveForDay(req.orgId, liturgy.potfLookup, {
      allowPlaceholders: Boolean(settings.usePlaceholderPotf),
    });
    res.json({
      date: req.params.date,
      occasionTitle: liturgy.occasionTitle,
      lookup: liturgy.potfLookup,
      matchedBy: resolved.matchedBy,
      template: resolved.template,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const template = await potfService.getTemplate(req.orgId, Number(req.params.id));
    if (!template) return res.status(404).json({ error: 'No such template.' });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await potfService.createTemplate(req.orgId, req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await potfService.updateTemplate(req.orgId, Number(req.params.id), req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    res.status(201).json(await potfService.duplicateTemplate(req.orgId, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await potfService.deleteTemplate(req.orgId, Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'No such template.' });
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
