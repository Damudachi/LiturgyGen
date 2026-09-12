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
router.post('/import', (req, res, next) => {
  try {
    const body = req.body || {};
    const parsed = parseOrilloPage(body.text);
    const template = potfService.createTemplate({
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

router.get('/', (req, res, next) => {
  try {
    res.json({
      templates: potfService.listTemplates({
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
    const resolved = potfService.resolveForDay(liturgy.potfLookup, {
      allowPlaceholders: Boolean(getSettings().usePlaceholderPotf),
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

router.get('/:id', (req, res, next) => {
  try {
    const template = potfService.getTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ error: 'No such template.' });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    res.status(201).json(potfService.createTemplate(req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    res.json(potfService.updateTemplate(Number(req.params.id), req.body || {}));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/duplicate', (req, res, next) => {
  try {
    res.status(201).json(potfService.duplicateTemplate(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const deleted = potfService.deleteTemplate(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'No such template.' });
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
