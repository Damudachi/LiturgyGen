/**
 * philippineOrdo - celebrations the ORDO for the Dioceses of the Philippines
 * keeps but the romcal Philippines calendar does not carry.
 *
 * We pin romcal at a 3.0.0-dev build, and its Philippines calendar is thin: for
 * 2026 it adds only Isidore the Farmer, Ezequiel Moreno, Lawrence Ruiz and
 * Guadalupe to the General Roman Calendar. The Santo Nino and San Pedro
 * Calungsod are missing outright, so the office would never see them.
 *
 * This file is the one place to reconcile the generated calendar against the
 * printed ORDO (our copy is the one edited by Fr. Genaro Diwa). Add an entry
 * here and it appears everywhere - occasion line, calendar colours, and the
 * Prayers of the Faithful lookup.
 *
 * Precedence is not decided here. Each override carries the romcal precedence
 * string for its class, and the day's celebrations are re-sorted by the Table
 * of Liturgical Days number encoded in that string. So a memorial correctly
 * yields to a Lenten weekday or the Triduum without any special-casing, and a
 * Feast of the Lord correctly displaces a Sunday in Ordinary Time.
 */

/**
 * The Table of Liturgical Days number carried in a romcal precedence string:
 * "TRIDUUM_1" -> 1, "UNPRIVILEGED_SUNDAY_6" -> 6, "PROPER_MEMORIAL_11B" -> 11.
 * Lower wins. Anything unparseable sorts last rather than jumping the queue.
 */
export function precedenceRank(precedence) {
  const match = /(\d+)[A-Z]?$/.exec(String(precedence || ''));
  return match ? Number(match[1]) : 99;
}

/** The nth weekday of a month, as "YYYY-MM-DD". nthWeekdayOfMonth(2026, 1, 0, 3) = 3rd Sunday of January. */
export function nthWeekdayOfMonth(year, month, dayOfWeek, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
  const date = new Date(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Celebrations to add. `on(year)` returns the ISO date, so a feast kept on a
 * Sunday moves with the year.
 *
 * Only what the ORDO carries and romcal does not. Deliberately short: an
 * invented entry is worse than a missing one, because the office would have no
 * reason to doubt it.
 */
export const ORDO_ADDITIONS = [
  {
    id: 'santo_nino',
    name: 'The Santo Niño',
    // The Feast of the Santo Nino is kept on the third Sunday of January and
    // takes the place of that Sunday in Ordinary Time. It is a Feast of the
    // Lord (precedence 5), which is why it outranks the Sunday (precedence 6) -
    // the same reason the Baptism of the Lord does.
    on: (year) => nthWeekdayOfMonth(year, 1, 0, 3),
    rank: 'FEAST',
    precedence: 'GENERAL_LORD_FEAST_5',
    colors: ['WHITE'],
    isHolyDayOfObligation: false,
    note: 'ORDO (Philippines): Feast, third Sunday of January.',
  },
  {
    id: 'pedro_calungsod_martyr',
    name: 'Saint Pedro Calungsod, Martyr',
    // 2 April. As a proper memorial it yields to a Lenten weekday, Holy Week
    // and the Easter octave - which is most years - and is kept when 2 April
    // falls on an ordinary weekday of Easter Time.
    on: (year) => `${year}-04-02`,
    rank: 'MEMORIAL',
    precedence: 'PROPER_MEMORIAL_11B',
    colors: ['RED'],
    isHolyDayOfObligation: false,
    note: 'ORDO (Philippines): Memorial, 2 April.',
  },
];

/**
 * Rank corrections for celebrations romcal already has but ranks differently
 * from the ORDO. Empty today - romcal agrees with our copy on the four
 * Philippine entries it does carry. Shape: { id, rank, precedence }.
 */
export const ORDO_RANK_OVERRIDES = [];

/**
 * An added celebration borrows the day's season, week and cycles from the
 * celebration already there, so only its identity differs. Without this a
 * feast would lose the week number the occasion line and the Prayers of the
 * Faithful lookup are built from.
 */
function buildEntry(addition, iso, context) {
  return {
    // Where in the year this day sits - copied so the occasion line and the
    // Prayers of the Faithful lookup still see the right season and week.
    seasons: context.seasons,
    periods: context.periods,
    calendar: context.calendar,
    cycles: context.cycles,
    // Who is celebrated - entirely our own. Nothing else is inherited, so the
    // entry never carries the displaced celebration's martyrology or titles.
    id: addition.id,
    date: iso,
    name: addition.name,
    rank: addition.rank,
    precedence: addition.precedence,
    colors: addition.colors,
    isHolyDayOfObligation: Boolean(addition.isHolyDayOfObligation),
    isOptional: addition.rank === 'OPTIONAL_MEMORIAL',
    fromCalendarId: 'philippines_ordo',
    fromOrdo: true,
  };
}

/**
 * Fold the ORDO into a generated romcal year, in place.
 *
 * Applied only to the Philippines calendar - asking for the General Roman
 * Calendar should return the General Roman Calendar.
 */
/**
 * Place one celebration in a day's list without moving anything already there.
 *
 * romcal's order is NOT a plain precedence sort - on Holy Thursday it lists the
 * day (precedence 9) ahead of the Mass of the Lord's Supper (precedence 1) -
 * and shape() reads the first entry as the one celebrated. Sorting a whole day
 * therefore rewrites romcal's own judgement: doing that cost Holy Thursday its
 * proper prayer. So we only ever insert, and every existing entry keeps its
 * position relative to every other.
 */
function insertByPrecedence(entries, entry) {
  const rank = precedenceRank(entry.precedence);
  const at = entries.findIndex((existing) => precedenceRank(existing.precedence) > rank);
  if (at === -1) entries.push(entry);
  else entries.splice(at, 0, entry);
}

export function applyOrdoOverrides(calendar, year) {
  for (const override of ORDO_RANK_OVERRIDES) {
    for (const entries of Object.values(calendar)) {
      const at = entries.findIndex((entry) => entry.id === override.id);
      if (at === -1) continue;
      const [entry] = entries.splice(at, 1);
      if (override.rank) entry.rank = override.rank;
      if (override.precedence) entry.precedence = override.precedence;
      insertByPrecedence(entries, entry);
    }
  }

  for (const addition of ORDO_ADDITIONS) {
    const iso = addition.on(year);
    if (!iso) continue;
    const entries = calendar[iso];
    // romcal generates a gregorian year, so a date it does not know about is a
    // bug in the override, not a day to invent from nothing.
    if (!entries || !entries.length) continue;
    if (entries.some((entry) => entry.id === addition.id)) continue;

    const [context] = entries;
    insertByPrecedence(entries, buildEntry(addition, iso, context));
  }

  return calendar;
}

export default applyOrdoOverrides;
