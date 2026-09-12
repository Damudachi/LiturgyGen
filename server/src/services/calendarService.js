/**
 * calendarService - wraps romcal (Philippines particular calendar) and renders
 * the liturgical occasion in the house style used by our missalettes, e.g.
 *   "FIRST WEEK OF ADVENT - WEDNESDAY"
 *   "33rd WEEK IN ORDINARY TIME - WEDNESDAY"
 */

import { Romcal } from 'romcal';
import * as philippines from '@romcal/calendar.philippines';
import config from '../config.js';
import { applyOrdoOverrides } from './philippineOrdo.js';
import { assertIsoDate, dayName, formatHeaderDate, parts, datesInMonth } from '../lib/dates.js';

const LOCALIZED_CALENDARS = {
  philippines: philippines.Philippines_En,
  general: undefined, // romcal falls back to the General Roman Calendar
};

const SEASONS = {
  ADVENT: { name: 'Advent', potfSeason: 'Advent', preposition: 'OF', ordinalStyle: 'word' },
  CHRISTMAS_TIME: { name: 'Christmas Time', potfSeason: 'Christmas', preposition: 'OF', ordinalStyle: 'word' },
  LENT: { name: 'Lent', potfSeason: 'Lent', preposition: 'OF', ordinalStyle: 'word' },
  PASCHAL_TRIDUUM: { name: 'Paschal Triduum', potfSeason: 'Triduum', preposition: 'OF', ordinalStyle: 'word' },
  EASTER_TIME: { name: 'Easter Time', potfSeason: 'Easter', preposition: 'OF', ordinalStyle: 'word' },
  ORDINARY_TIME: { name: 'Ordinary Time', potfSeason: 'Ordinary Time', preposition: 'IN', ordinalStyle: 'numeric' },
};

const RANK_LABELS = {
  SOLEMNITY: 'Solemnity',
  FEAST: 'Feast',
  MEMORIAL: 'Memorial',
  OPTIONAL_MEMORIAL: 'Optional Memorial',
  SUNDAY: 'Sunday',
  WEEKDAY: 'Weekday',
};

const LITURGICAL_COLORS = {
  RED: { name: 'Red', hex: '#b91c1c' },
  ROSE: { name: 'Rose', hex: '#db7093' },
  PURPLE: { name: 'Violet', hex: '#6d28d9' },
  GREEN: { name: 'Green', hex: '#15803d' },
  WHITE: { name: 'White', hex: '#d4d4d8' },
  GOLD: { name: 'Gold', hex: '#ca8a04' },
  BLACK: { name: 'Black', hex: '#27272a' },
};

const WORD_ORDINALS = [
  '', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH',
  'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH',
  'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH',
  'TWENTY-FIRST', 'TWENTY-SECOND', 'TWENTY-THIRD', 'TWENTY-FOURTH', 'TWENTY-FIFTH',
  'TWENTY-SIXTH', 'TWENTY-SEVENTH', 'TWENTY-EIGHTH', 'TWENTY-NINTH', 'THIRTIETH',
  'THIRTY-FIRST', 'THIRTY-SECOND', 'THIRTY-THIRD', 'THIRTY-FOURTH',
];

/** 1 -> "1st", 22 -> "22nd", 33 -> "33rd". */
export function numericOrdinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function wordOrdinal(n) {
  return WORD_ORDINALS[n] || numericOrdinal(n).toUpperCase();
}

const calendarCache = new Map();

function romcalFor(calendarKey) {
  return new Romcal({
    localizedCalendar: LOCALIZED_CALENDARS[calendarKey],
    scope: 'gregorian',
    epiphanyOnSunday: config.calendar.epiphanyOnSunday,
    ascensionOnSunday: config.calendar.ascensionOnSunday,
    corpusChristiOnSunday: config.calendar.corpusChristiOnSunday,
  });
}

/**
 * romcal recomputes an entire year per call, so cache the generated years.
 *
 * The Philippine year is reconciled against the printed ORDO on the way out -
 * see philippineOrdo.js. Asking for the General Roman Calendar deliberately
 * skips that, so "general" stays a clean point of comparison.
 */
async function calendarForYear(year, calendarKey = config.calendar.particularCalendar) {
  const cacheKey = `${calendarKey}:${year}`;
  if (!calendarCache.has(cacheKey)) {
    const generated = romcalFor(calendarKey)
      .generateCalendar(year)
      .then((calendar) =>
        calendarKey === 'philippines' ? applyOrdoOverrides(calendar, year) : calendar,
      );
    calendarCache.set(cacheKey, generated);
  }
  return calendarCache.get(cacheKey);
}

/**
 * The line printed above the Prayers of the Faithful. Weekdays of Advent, Lent,
 * Christmas and Easter spell the week out ("FIRST WEEK OF ADVENT - WEDNESDAY");
 * Ordinary Time uses a numeric ordinal ("33rd WEEK IN ORDINARY TIME - WEDNESDAY").
 * Solemnities, feasts and memorials are titled by their own name.
 */
export function formatOccasionTitle(day, iso) {
  const rank = day.rank;
  const seasonKey = day.seasons && day.seasons[0];
  const season = SEASONS[seasonKey];
  const week = day.calendar ? day.calendar.weekOfSeason : 0;
  const upperDay = dayName(iso).toUpperCase();

  if (rank === 'SOLEMNITY' || rank === 'FEAST') {
    return (day.name || '').toUpperCase();
  }

  if (rank === 'MEMORIAL') {
    // Memorials keep their own title but the ferial day is still useful context.
    return (day.name || '').toUpperCase();
  }

  if (!season) return (day.name || '').toUpperCase();

  const ordinal = season.ordinalStyle === 'word' ? wordOrdinal(week) : numericOrdinal(week);

  if (rank === 'SUNDAY' || parts(iso).dayOfWeek === 0) {
    return `${ordinal} SUNDAY ${season.preposition} ${season.name.toUpperCase()}`;
  }

  if (!week) {
    // Days outside a numbered week (Ash Wednesday, Holy Week, Christmas octave...)
    return (day.name || '').toUpperCase();
  }

  return `${ordinal} WEEK ${season.preposition} ${season.name.toUpperCase()} - ${upperDay}`;
}

function toColor(colorKey) {
  const color = LITURGICAL_COLORS[colorKey];
  return { key: colorKey, name: color ? color.name : colorKey, hex: color ? color.hex : '#71717a' };
}

function shape(iso, entries) {
  // romcal returns celebrations for a date in precedence order; the first is the
  // one actually celebrated, the rest are optional memorials the priest may take.
  const [primary, ...alternatives] = entries;
  const seasonKey = primary.seasons && primary.seasons[0];
  const season = SEASONS[seasonKey];
  const week = primary.calendar ? primary.calendar.weekOfSeason : null;
  const p = parts(iso);

  const isFeastLike = ['SOLEMNITY', 'FEAST', 'MEMORIAL'].includes(primary.rank);

  return {
    date: iso,
    headerDate: formatHeaderDate(iso),
    dayOfWeek: p.dayName,
    celebration: {
      id: primary.id,
      name: primary.name,
      rank: primary.rank,
      rankLabel: RANK_LABELS[primary.rank] || primary.rank,
      isHolyDayOfObligation: Boolean(primary.isHolyDayOfObligation),
      color: toColor((primary.colors && primary.colors[0]) || 'GREEN'),
      colors: (primary.colors || []).map(toColor),
    },
    season: {
      key: seasonKey || null,
      name: season ? season.name : null,
      week: week || null,
      period: (primary.periods && primary.periods[0]) || null,
    },
    cycles: {
      sunday: primary.cycles ? primary.cycles.sundayCycle : null,
      weekday: primary.cycles ? primary.cycles.weekdayCycle : null,
      psalterWeek: primary.cycles ? primary.cycles.psalterWeek : null,
    },
    occasionTitle: formatOccasionTitle(primary, iso),
    /** The key used to pick a Prayers of the Faithful template from the database. */
    potfLookup: {
      season: isFeastLike ? 'Feast' : (season ? season.potfSeason : 'Ordinary Time'),
      ferialSeason: season ? season.potfSeason : 'Ordinary Time',
      week: week || null,
      dayOfWeek: p.dayName,
      rank: primary.rank,
      celebrationId: primary.id,
      /**
       * Every celebration the office could actually keep today: the one the
       * calendar assigns, plus any optional memorial it may be swapped for.
       *
       * The date rule below uses this to tell "the book has a prayer for this
       * feast, and the feast is available today" from "the book has a prayer
       * dated today, but the feast is not kept this year" - 25 March is the
       * Annunciation most years and Holy Thursday in others.
       */
      availableCelebrationIds: [primary.id, ...alternatives.map((entry) => entry.id)].filter(
        Boolean,
      ),
      /** MM-DD, for the stretches the book keys to the calendar. */
      fixedDate: iso.slice(5),
    },
    optionalMemorials: alternatives.map((entry) => ({
      id: entry.id,
      name: entry.name,
      rank: entry.rank,
      rankLabel: RANK_LABELS[entry.rank] || entry.rank,
      color: toColor((entry.colors && entry.colors[0]) || 'WHITE'),
    })),
  };
}

async function entriesFor(iso, calendarKey) {
  const calendar = await calendarForYear(Number(iso.slice(0, 4)), calendarKey);
  return calendar[iso];
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ordinaryWeekOf(entries) {
  const primary = entries && entries[0];
  if (!primary || !primary.seasons || primary.seasons[0] !== 'ORDINARY_TIME') return null;
  return (primary.calendar && primary.calendar.weekOfSeason) || null;
}

/**
 * The Ordinary Time week whose prayer stands in for a day outside Ordinary
 * Time: the nearest Ordinary Time date falling on the same weekday, looking a
 * week either way at a time and preferring the week ahead on a tie. The
 * weekdays after Epiphany take week 1; a weekday of Advent takes week 34.
 * The longest stretch without Ordinary Time (Lent through Pentecost) is under
 * fifteen weeks, so the search always ends well inside its limit.
 */
async function nearestOrdinaryWeek(iso, calendarKey) {
  for (let weeks = 1; weeks <= 26; weeks += 1) {
    for (const days of [7 * weeks, -7 * weeks]) {
      const week = ordinaryWeekOf(await entriesFor(addDays(iso, days), calendarKey));
      if (week) return week;
    }
  }
  return null;
}

/** Liturgical information for a single "YYYY-MM-DD" date. */
export async function getLiturgicalDay(iso, calendarKey) {
  assertIsoDate(iso);
  const entries = await entriesFor(iso, calendarKey);
  if (!entries || !entries.length) {
    const err = new Error(`romcal produced no liturgical day for ${iso}.`);
    err.status = 500;
    throw err;
  }
  const day = shape(iso, entries);
  day.potfLookup.ordinaryWeek =
    ordinaryWeekOf(entries) ?? (await nearestOrdinaryWeek(iso, calendarKey));
  return day;
}

/** Liturgical information for many dates, reusing each generated year. */
export async function getLiturgicalDays(isoDates, calendarKey) {
  const out = [];
  for (const iso of isoDates) {
    out.push(await getLiturgicalDay(iso, calendarKey));
  }
  return out;
}

/** Every day of a month - powers the colour-coded calendar pickers in the UI. */
export async function getMonth(year, month, calendarKey) {
  return getLiturgicalDays(datesInMonth(year, month), calendarKey);
}

export function availableCalendars() {
  return Object.keys(LOCALIZED_CALENDARS);
}

export default {
  getLiturgicalDay,
  getLiturgicalDays,
  getMonth,
  formatOccasionTitle,
  availableCalendars,
  numericOrdinal,
  wordOrdinal,
};
