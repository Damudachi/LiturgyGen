/**
 * potfService - Prayers of the Faithful templates.
 *
 * Templates are matched to a date from most to least specific:
 *   1. the celebration itself      (celebration_id = "lawrence_ruiz_...")
 *   1a. the calendar date          (fixed_date = "05-13", while the feast is kept)
 *   2. season + week + weekday     ("Advent", 1, "Wednesday")
 *   3. season + week               (any weekday that week)
 *   4. season + weekday            (every "Wednesday in Ordinary Time")
 *   5. season                      (the season's fallback)
 *   6. the ferial season           (used when a memorial has no proper template)
 *
 * That mirrors how the office actually works with the two General Intercessions
 * volumes: the Proper of Seasons book first, the Ordinary Time book otherwise.
 */

import { getDb } from '../db/index.js';

const ORDINARY_TIME = 'Ordinary Time';
const SEASONS = [ORDINARY_TIME, 'Advent', 'Christmas', 'Lent', 'Triduum', 'Easter', 'Feast'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    // Tolerate a plain newline-separated list typed straight into the editor.
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
}

function rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    season: row.season,
    week: row.week,
    dayOfWeek: row.day_of_week,
    celebrationId: row.celebration_id,
    fixedDate: row.fixed_date,
    priestInvitation: row.priest_invitation,
    responseOptions: parseJsonArray(row.response_options),
    intentions: parseJsonArray(row.intentions),
    priestConclusion: row.priest_conclusion,
    notes: row.notes,
    origin: row.origin,
    isPlaceholder: Boolean(row.is_placeholder),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export function normaliseInput(input, { partial = false } = {}) {
  const out = {};

  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const require = (key, label) => {
    if (!partial && !has(key)) throw validationError(`${label} is required.`);
    return has(key);
  };

  if (require('title', 'Title')) {
    const title = String(input.title || '').trim();
    if (!title) throw validationError('Title cannot be empty.');
    out.title = title;
  }

  if (require('season', 'Season')) {
    const season = String(input.season || '').trim();
    if (!SEASONS.includes(season)) {
      throw validationError(`Season must be one of: ${SEASONS.join(', ')}.`);
    }
    out.season = season;
  }

  if (has('week')) {
    if (input.week === null || input.week === '' || input.week === undefined) {
      out.week = null;
    } else {
      const week = Number(input.week);
      if (!Number.isInteger(week) || week < 1 || week > 34) {
        throw validationError('Week must be a whole number from 1 to 34, or blank for any week.');
      }
      out.week = week;
    }
  }

  if (has('dayOfWeek')) {
    const day = input.dayOfWeek == null ? null : String(input.dayOfWeek).trim();
    if (day && !DAYS.includes(day)) {
      throw validationError(`Day of week must be one of: ${DAYS.join(', ')}.`);
    }
    out.dayOfWeek = day || null;
  }

  if (has('celebrationId')) {
    out.celebrationId = input.celebrationId ? String(input.celebrationId).trim() : null;
  }

  if (has('fixedDate')) {
    const raw = input.fixedDate ? String(input.fixedDate).trim() : null;
    if (raw && !/^\d{2}-\d{2}$/.test(raw)) {
      throw validationError('Calendar date must be written as MM-DD, for example 01-02.');
    }
    out.fixedDate = raw;
  }

  if (has('priestInvitation')) out.priestInvitation = String(input.priestInvitation || '').trim();
  if (has('priestConclusion')) out.priestConclusion = String(input.priestConclusion || '').trim();
  if (has('notes')) out.notes = input.notes == null ? null : String(input.notes);

  if (has('responseOptions')) {
    const options = parseJsonArray(input.responseOptions)
      .map((option) => String(option).trim())
      .filter(Boolean);
    if (!partial && options.length === 0) {
      throw validationError('At least one response option is required.');
    }
    out.responseOptions = options;
  }

  if (has('intentions')) {
    const intentions = parseJsonArray(input.intentions)
      .map((intention) => String(intention).trim())
      .filter(Boolean);
    if (!partial && intentions.length === 0) {
      throw validationError('At least one intention is required.');
    }
    out.intentions = intentions;
  }

  if (has('isActive')) out.isActive = Boolean(input.isActive);

  return out;
}

/* ------------------------------------------------------------------ *
 * CRUD
 * ------------------------------------------------------------------ */

export function listTemplates({ season, week, dayOfWeek, search, includeInactive = false } = {}) {
  const clauses = [];
  const params = {};

  if (!includeInactive) clauses.push('is_active = 1');
  if (season) {
    clauses.push('season = @season');
    params.season = season;
  }
  if (week != null && week !== '') {
    clauses.push('(week = @week OR week IS NULL)');
    params.week = Number(week);
  }
  if (dayOfWeek) {
    clauses.push('(day_of_week = @dayOfWeek OR day_of_week IS NULL)');
    params.dayOfWeek = dayOfWeek;
  }
  if (search) {
    clauses.push('(title LIKE @search OR priest_invitation LIKE @search OR intentions LIKE @search)');
    params.search = `%${search}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb()
    .prepare(
      `SELECT * FROM potf_templates ${where}
       ORDER BY season, COALESCE(week, 99), COALESCE(day_of_week, 'zz'), title`,
    )
    .all(params);
  return rows.map(rowToTemplate);
}

export function getTemplate(id) {
  return rowToTemplate(getDb().prepare('SELECT * FROM potf_templates WHERE id = ?').get(id));
}

export function createTemplate(input) {
  const data = normaliseInput(input);
  const result = getDb()
    .prepare(
      `INSERT INTO potf_templates
        (title, season, week, day_of_week, celebration_id, fixed_date, priest_invitation,
         response_options, intentions, priest_conclusion, notes, origin, is_active)
       VALUES
        (@title, @season, @week, @dayOfWeek, @celebrationId, @fixedDate, @priestInvitation,
         @responseOptions, @intentions, @priestConclusion, @notes, @origin, @isActive)`,
    )
    .run({
      title: data.title,
      season: data.season,
      week: data.week ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      celebrationId: data.celebrationId ?? null,
      fixedDate: data.fixedDate ?? null,
      priestInvitation: data.priestInvitation ?? '',
      responseOptions: JSON.stringify(data.responseOptions ?? []),
      intentions: JSON.stringify(data.intentions ?? []),
      priestConclusion: data.priestConclusion ?? '',
      notes: data.notes ?? null,
      origin: input.origin === 'seed' ? 'seed' : 'custom',
      isActive: data.isActive === false ? 0 : 1,
    });
  return getTemplate(result.lastInsertRowid);
}

export function updateTemplate(id, input) {
  const existing = getTemplate(id);
  if (!existing) {
    const err = new Error(`No Prayers of the Faithful template with id ${id}.`);
    err.status = 404;
    throw err;
  }

  const data = normaliseInput(input, { partial: true });
  const columns = {
    title: 'title',
    season: 'season',
    week: 'week',
    dayOfWeek: 'day_of_week',
    celebrationId: 'celebration_id',
    fixedDate: 'fixed_date',
    priestInvitation: 'priest_invitation',
    priestConclusion: 'priest_conclusion',
    notes: 'notes',
    isActive: 'is_active',
  };

  const sets = [];
  const params = { id };

  for (const [key, column] of Object.entries(columns)) {
    if (key in data) {
      sets.push(`${column} = @${key}`);
      params[key] = key === 'isActive' ? (data[key] ? 1 : 0) : data[key];
    }
  }
  if ('responseOptions' in data) {
    sets.push('response_options = @responseOptions');
    params.responseOptions = JSON.stringify(data.responseOptions);
  }
  if ('intentions' in data) {
    sets.push('intentions = @intentions');
    params.intentions = JSON.stringify(data.intentions);
  }

  // Rewriting a placeholder's text makes it the office's own prayer, so dates
  // may resolve to it from now on without the placeholder setting.
  const textKeys = ['priestInvitation', 'priestConclusion', 'responseOptions', 'intentions'];
  if (existing.isPlaceholder && textKeys.some((key) => key in data)) {
    sets.push('is_placeholder = 0');
  }

  if (!sets.length) return existing;

  sets.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE potf_templates SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getTemplate(id);
}

export function deleteTemplate(id) {
  const result = getDb().prepare('DELETE FROM potf_templates WHERE id = ?').run(id);
  return result.changes > 0;
}

export function duplicateTemplate(id) {
  const source = getTemplate(id);
  if (!source) {
    const err = new Error(`No Prayers of the Faithful template with id ${id}.`);
    err.status = 404;
    throw err;
  }
  const copy = createTemplate({ ...source, title: `${source.title} (copy)`, origin: 'custom' });
  // A copy of a placeholder is still the placeholder's text until someone edits it.
  if (source.isPlaceholder) {
    getDb().prepare('UPDATE potf_templates SET is_placeholder = 1 WHERE id = ?').run(copy.id);
    return getTemplate(copy.id);
  }
  return copy;
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

const UNKEYED = 'AND celebration_id IS NULL AND fixed_date IS NULL';

const MATCH_RULES = [
  {
    reason: 'celebration',
    sql: 'celebration_id IS NOT NULL AND celebration_id = @celebrationId',
    needs: (l) => Boolean(l.celebrationId),
  },
  {
    // Below celebration id on purpose: when 2 January is Epiphany, the Epiphany
    // prayer must win over the book's "Second of January".
    //
    // A dated row that also names a celebration only matches while that
    // celebration is actually kept - it is a prayer for the feast, not for the
    // square on the calendar. This is what lets the book's optional memorials
    // (Lourdes, Fatima, Mount Carmel, Joseph the Worker) resolve at all, since
    // an optional memorial is never the day's assigned celebration, without
    // also printing the Annunciation on a 25 March that is Holy Thursday.
    //
    // Rows carrying a date and no celebration - the book's "Second of January"
    // stretches - keep matching on the date alone.
    reason: 'calendar date',
    sql: ({ availableIds }) =>
      `fixed_date IS NOT NULL AND fixed_date = @fixedDate
       AND (celebration_id IS NULL OR celebration_id IN (${availableIds}))`,
    needs: (l) => Boolean(l.fixedDate),
  },
  {
    reason: 'season + week + day',
    sql: 'season = @season AND week = @week AND day_of_week = @dayOfWeek',
    needs: (l) => l.week != null,
  },
  // The looser rules below only take rows that belong to no particular feast
  // or date. A feast's prayer also has no week and no weekday, so without this
  // the "season" rule printed the Conversion of St Paul on Easter Sunday and
  // "17 December" on every Sunday of Advent - hidden for as long as a
  // placeholder happened to win the tie.
  {
    reason: 'season + week',
    sql: `season = @season AND week = @week AND day_of_week IS NULL ${UNKEYED}`,
    needs: (l) => l.week != null,
  },
  {
    reason: 'season + day',
    sql: `season = @season AND week IS NULL AND day_of_week = @dayOfWeek ${UNKEYED}`,
    needs: () => true,
  },
  {
    reason: 'season',
    // The whole-season catch-all. Deliberately last, and skipped on the first
    // pass - see resolveForDay.
    sql: `season = @season AND week IS NULL AND day_of_week IS NULL ${UNKEYED}`,
    needs: () => true,
    catchAll: true,
  },
];

function findBy(lookup, season, { includeCatchAll = true, allowPlaceholders = false } = {}) {
  const db = getDb();
  const params = {
    season,
    week: lookup.week ?? null,
    dayOfWeek: lookup.dayOfWeek ?? null,
    celebrationId: lookup.celebrationId ?? null,
    fixedDate: lookup.fixedDate ?? null,
  };
  const source = allowPlaceholders ? '' : 'AND is_placeholder = 0';

  // The celebrations that may be kept today, bound one placeholder each.
  // Older callers that pass only a celebrationId still behave as they did.
  const available =
    Array.isArray(lookup.availableCelebrationIds) && lookup.availableCelebrationIds.length
      ? lookup.availableCelebrationIds
      : [lookup.celebrationId].filter(Boolean);
  available.forEach((id, i) => {
    params[`available${i}`] = id;
  });
  // No celebration at all: IN (NULL) is never true, so only undated-celebration
  // rows match - which is what a day with nothing to keep should do.
  const availableIds = available.length ? available.map((_, i) => `@available${i}`).join(', ') : 'NULL';

  for (const rule of MATCH_RULES) {
    if (rule.catchAll && !includeCatchAll) continue;
    if (!rule.needs(lookup)) continue;
    const sql = typeof rule.sql === 'function' ? rule.sql({ availableIds }) : rule.sql;
    const row = db
      .prepare(`SELECT * FROM potf_templates WHERE is_active = 1 ${source} AND ${sql} LIMIT 1`)
      .get(params);
    if (row) return { template: rowToTemplate(row), reason: rule.reason };
  }
  return null;
}

/**
 * Pick the template for a liturgical day. `lookup` is `potfLookup` from
 * calendarService. Returns { template, matchedBy } or { template: null }.
 *
 * The office works from two volumes: the Proper of Seasons, Solemnities and
 * Feasts first, the Ordinary Time volume when that has nothing for the day.
 * Placeholders written for this tool are skipped unless `allowPlaceholders`
 * is set - by default a day neither book covers resolves to nothing, and the
 * document says so rather than printing a prayer the office never chose.
 */
export function resolveForDay(lookup, { allowPlaceholders = false } = {}) {
  if (!lookup) return { template: null, matchedBy: 'none' };

  const find = (l, season, options = {}) => findBy(l, season, { allowPlaceholders, ...options });
  const hasFerial = Boolean(lookup.ferialSeason) && lookup.ferialSeason !== lookup.season;

  // Anything specific wins first, in both seasons. Without this, an ordinary
  // memorial in Advent matched the generic "Feast" catch-all and printed a
  // placeholder, even though the book has a proper prayer for that Advent
  // weekday - which is the one the office actually prays.
  const specific = find(lookup, lookup.season, { includeCatchAll: false });
  if (specific) return { template: specific.template, matchedBy: specific.reason };

  if (hasFerial) {
    const ferialSpecific = find(lookup, lookup.ferialSeason, { includeCatchAll: false });
    if (ferialSpecific) {
      return {
        template: ferialSpecific.template,
        matchedBy: `${ferialSpecific.reason} (ferial fallback)`,
      };
    }
  }

  // When the occasion has no prayer of its own, the office prays the Ordinary
  // Time prayer for that day. This sits above the whole-season catch-alls on
  // purpose: a real prayer for the right weekday is closer to what the office
  // wants than a generic "any day in Lent" text.
  //
  // "Advent, week 1" and "Ordinary Time, week 1" are unrelated, so the day's
  // own week number cannot be used. calendarService supplies `ordinaryWeek`,
  // the nearest Ordinary Time week on the same weekday, which is what reaches
  // the book: every one of its prayers belongs to a numbered week.
  const isOrdinary = lookup.season === ORDINARY_TIME || lookup.ferialSeason === ORDINARY_TIME;
  // Not in the Triduum: Good Friday has its own Solemn Intercessions and Holy
  // Saturday no Mass, so a weekday prayer from Ordinary Time never belongs.
  const borrowsOrdinary = !isOrdinary && lookup.ferialSeason !== 'Triduum';
  const ordinaryLookup = { ...lookup, week: lookup.ordinaryWeek ?? null };
  const ordinaryReason = (reason) =>
    ordinaryLookup.week
      ? `${reason} (Ordinary Time fallback, week ${ordinaryLookup.week})`
      : `${reason} (Ordinary Time fallback)`;

  if (borrowsOrdinary) {
    const ordinaryDay = find(ordinaryLookup, ORDINARY_TIME, { includeCatchAll: false });
    if (ordinaryDay) {
      return { template: ordinaryDay.template, matchedBy: ordinaryReason(ordinaryDay.reason) };
    }
  }

  // Only now the whole-season catch-alls, proper season before ferial.
  const primary = find(lookup, lookup.season);
  if (primary) return { template: primary.template, matchedBy: primary.reason };

  if (hasFerial) {
    const ferial = find(lookup, lookup.ferialSeason);
    if (ferial) {
      return { template: ferial.template, matchedBy: `${ferial.reason} (ferial fallback)` };
    }
  }

  // Nothing at all for the season: the Ordinary Time catch-all is still better
  // than printing no prayers.
  if (borrowsOrdinary) {
    const ordinary = find(ordinaryLookup, ORDINARY_TIME);
    if (ordinary) {
      return { template: ordinary.template, matchedBy: ordinaryReason(ordinary.reason) };
    }
  }

  return { template: null, matchedBy: 'none' };
}

/**
 * The template as the document generator wants it, with any school-wide
 * intentions appended (batch mode injects the same closing intentions everywhere).
 */
export function composePotf(template, { extraIntentions = [], maxIntentions = null } = {}) {
  if (!template) return null;
  let intentions = [...template.intentions, ...extraIntentions.filter(Boolean)];
  if (maxIntentions && intentions.length > maxIntentions) {
    intentions = intentions.slice(0, maxIntentions);
  }
  return {
    templateId: template.id,
    title: template.title,
    priestInvitation: template.priestInvitation,
    responseOptions: template.responseOptions,
    intentions,
    priestConclusion: template.priestConclusion,
  };
}

export const POTF_SEASONS = SEASONS;
export const POTF_DAYS = DAYS;

export default {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  resolveForDay,
  composePotf,
  POTF_SEASONS,
  POTF_DAYS,
};
