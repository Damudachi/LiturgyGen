import { Router } from 'express';
import { isIsoDate, readingsFileName } from '../lib/dates.js';
import { buildDay, styleFromSettings } from '../services/compositionService.js';
import { buildDayDocx } from '../services/docxService.js';
import { getSettings } from '../db/index.js';

const router = Router();

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Generate one .docx.
 *
 * Body: { date, potfTemplateId?, potfOverride?, readingsOverride?,
 *         extraIntentions?, occasionTitle?, style? }
 * Everything but `date` is optional and comes from whatever the user edited in
 * the preview pane, so the download always matches what they are looking at.
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      date,
      potfTemplateId = null,
      potfOverride = null,
      readingsOverride = null,
      extraIntentions = null,
      occasionTitle = null,
      style = {},
      force = false,
    } = req.body || {};

    if (!isIsoDate(date)) return res.status(400).json({ error: 'Provide a date as YYYY-MM-DD.' });

    const settings = getSettings();
    const day = await buildDay(date, {
      force,
      potfTemplateId,
      potfOverride,
      readingsOverride,
      extraIntentions,
      occasionTitle,
      settings,
    });

    if (day.readingsError) {
      return res.status(502).json({
        error: day.readingsError.message,
        code: day.readingsError.code,
        date,
        hint:
          'Open the date in the Single Date tab and use "Import readings" to paste the ' +
          'saved USCCB page, then generate again.',
      });
    }

    const buffer = await buildDayDocx(day, styleFromSettings(settings, style));
    const fileName = readingsFileName(date);

    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-LiturgyGen-Warnings', encodeURIComponent(JSON.stringify(day.warnings)));
    res.end(buffer);
  } catch (error) {
    next(error);
  }
});

/** Preview without downloading - returns the composed day as JSON. */
router.post('/preview', async (req, res, next) => {
  try {
    const { date, ...rest } = req.body || {};
    if (!isIsoDate(date)) return res.status(400).json({ error: 'Provide a date as YYYY-MM-DD.' });
    res.json(await buildDay(date, rest));
  } catch (error) {
    next(error);
  }
});

export default router;
