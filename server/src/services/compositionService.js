/**
 * compositionService - assembles the three sources (liturgical calendar,
 * readings, Prayers of the Faithful) into the single object docxService renders.
 */

import { getSettings } from '../db/index.js';
import { assertIsoDate, formatHeaderDate, readingsFileName } from '../lib/dates.js';
import { getLiturgicalDay, ordinaryTimeTitle } from './calendarService.js';
import { getReadings, peekReadings } from './scraperService.js';
import { composePotf, getTemplate, resolveForDay } from './potfService.js';

/**
 * The heading printed above the intercessions. It names the day the prayer was
 * written for: when an occasion borrows an Ordinary Time prayer - a memorial
 * with no proper of its own, or a Christmas weekday - the heading is that
 * Ordinary Time day, not the occasion, so it matches the prayer beneath it.
 */
export function potfHeading(template, liturgy, occasionTitle) {
  const isOccasion = liturgy.potfLookup.season !== 'Ordinary Time';
  if (isOccasion && template && template.season === 'Ordinary Time' && template.week && template.dayOfWeek) {
    return ordinaryTimeTitle(template.week, template.dayOfWeek);
  }
  return occasionTitle;
}

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
    potfTitle = null,
    settings = getSettings(),
    offline = false,
  } = options;

  const liturgy = await getLiturgicalDay(iso);

  let readings;
  let readingsError = null;
  try {
    if (offline) {
      readings = peekReadings(iso, { providers });
      if (!readings) {
        const err = new Error('The readings for this day have not been fetched yet.');
        err.code = 'NOT_FETCHED';
        throw err;
      }
    } else {
      readings = await getReadings(iso, { force, providers });
    }
  } catch (error) {
    readingsError = { code: error.code || 'ERROR', message: error.message };
    readings = null;
  }

  if (readingsOverride) {
    readings = { ...(readings || {}), ...readingsOverride, date: iso };
  }

  let potf = null;
  let potfMatch = 'none';
  let template = null;

  if (potfOverride) {
    potf = potfOverride;
    potfMatch = 'supplied by the editor';
  } else {
    template = potfTemplateId ? getTemplate(potfTemplateId) : null;
    if (template) {
      potfMatch = 'chosen manually';
    } else {
      const resolved = resolveForDay(liturgy.potfLookup, {
        allowPlaceholders: Boolean(settings.usePlaceholderPotf),
      });
      potfMatch = resolved.matchedBy;
      template = resolved.template;
    }
    potf = composePotf(template, {
      extraIntentions: extraIntentions ?? settings.schoolWideIntentions ?? [],
    });
  }

  const heading = occasionTitle || liturgy.occasionTitle;

  const warnings = [...((readings && readings.warnings) || [])];
  if (readingsError) warnings.push(readingsError.message);
  if (!potf) {
    warnings.push(
      `Neither book has Prayers of the Faithful for ${liturgy.occasionTitle}, so the document ` +
        'will be printed without them. Choose a prayer for this day, add one under Prayers, ' +
        'or turn on placeholder prayers in Settings.',
    );
  }

  return {
    date: iso,
    headerDate: formatHeaderDate(iso),
    fileName: readingsFileName(iso),
    occasionTitle: heading,
    potfTitle: potfTitle || potfHeading(template, liturgy, heading),
    liturgy,
    readings,
    readingsError,
    potf,
    potfMatch,
    warnings,
    isComplete: !readingsError && warnings.length === 0,
  };
}

/**
 * What stands between a day and a finished document, from what is already on
 * hand - no source is asked, so a whole month is checked in a moment. This is
 * what lets "Select several days" flag the days that need a look before anyone
 * makes the files.
 *
 * `fetched` is false for a day whose readings were never fetched; its warnings
 * then cover only what can be known without them (the prayers). `refetchable`
 * marks a partial fallback copy that fetching again may complete.
 */
export async function checkDay(iso, options = {}) {
  const day = await buildDay(iso, { ...options, offline: true });
  const fetched = !(day.readingsError && day.readingsError.code === 'NOT_FETCHED');
  return {
    date: iso,
    fetched,
    refetchable: Boolean(day.readings && day.readings.refetchable),
    warnings: fetched ? day.warnings : day.warnings.filter((warning) => warning !== day.readingsError.message),
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

export default { buildDay, checkDay, styleFromSettings, potfHeading };
