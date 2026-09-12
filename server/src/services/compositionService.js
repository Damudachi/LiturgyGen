/**
 * compositionService - assembles the three sources (liturgical calendar,
 * readings, Prayers of the Faithful) into the single object docxService renders.
 */

import { getSettings } from '../db/index.js';
import { assertIsoDate, formatHeaderDate, readingsFileName } from '../lib/dates.js';
import { getLiturgicalDay } from './calendarService.js';
import { getReadings } from './scraperService.js';
import { composePotf, getTemplate, resolveForDay } from './potfService.js';

/**
 * Build one day.
 *
 * `overrides` lets the Single Date tab hand back whatever the user edited on
 * screen - a corrected psalm response, a different POTF template, extra
 * intentions - without those edits having to be saved first.
 */
export async function buildDay(iso, options = {}) {
  assertIsoDate(iso);
  const {
    force = false,
    providers = null,
    potfTemplateId = null,
    potfOverride = null,
    readingsOverride = null,
    extraIntentions = null,
    occasionTitle = null,
    settings = getSettings(),
  } = options;

  const liturgy = await getLiturgicalDay(iso);

  let readings;
  let readingsError = null;
  try {
    readings = await getReadings(iso, { force, providers });
  } catch (error) {
    readingsError = { code: error.code || 'ERROR', message: error.message };
    readings = null;
  }

  if (readingsOverride) {
    readings = { ...(readings || {}), ...readingsOverride, date: iso };
  }

  let potf = null;
  let potfMatch = 'none';

  if (potfOverride) {
    potf = potfOverride;
    potfMatch = 'supplied by the editor';
  } else {
    const template = potfTemplateId ? getTemplate(potfTemplateId) : null;
    if (template) {
      potf = composePotf(template, {
        extraIntentions: extraIntentions ?? settings.schoolWideIntentions ?? [],
      });
      potfMatch = 'chosen manually';
    } else {
      const resolved = resolveForDay(liturgy.potfLookup, {
        allowPlaceholders: Boolean(settings.usePlaceholderPotf),
      });
      potfMatch = resolved.matchedBy;
      potf = composePotf(resolved.template, {
        extraIntentions: extraIntentions ?? settings.schoolWideIntentions ?? [],
      });
    }
  }

  const warnings = [...((readings && readings.warnings) || [])];
  if (readingsError) warnings.push(readingsError.message);
  if (!potf) {
    warnings.push(
      `Neither book has Prayers of the Faithful for ${liturgy.occasionTitle}, so the document ` +
        'will be printed without them. Choose a prayer for this day, add one in the Template ' +
        'Manager, or turn on placeholder prayers in Settings.',
    );
  }

  return {
    date: iso,
    headerDate: formatHeaderDate(iso),
    fileName: readingsFileName(iso),
    occasionTitle: occasionTitle || liturgy.occasionTitle,
    liturgy,
    readings,
    readingsError,
    potf,
    potfMatch,
    warnings,
    isComplete: !readingsError && warnings.length === 0,
  };
}

/** Style overrides for docxService, derived from saved settings. */
export function styleFromSettings(settings = getSettings(), extra = {}) {
  return {
    font: settings.font,
    options: {
      includeGospel: settings.includeGospel,
      includeSequence: settings.includeSequence,
      separatePages: settings.separatePages,
      // The style holds the Word highlight name; the setting is a plain switch.
      highlightFirstRefrain: settings.highlightFirstRefrain ? 'yellow' : null,
      repeatPsalmRefrain: settings.repeatPsalmRefrain,
      firstRefrainUppercase: settings.firstRefrainUppercase,
      appendIntentionSuffix: settings.appendIntentionSuffix,
      spaceBetweenIntentions: settings.spaceBetweenIntentions,
      ...(extra.options || {}),
    },
    ...(extra.page ? { page: extra.page } : {}),
    ...(extra.size ? { size: extra.size } : {}),
    ...(extra.text ? { text: extra.text } : {}),
  };
}

export default { buildDay, styleFromSettings };
