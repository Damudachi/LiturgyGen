/**
 * Date helpers. Every date in LiturgyGen is a plain "YYYY-MM-DD" local calendar
 * day - never a Date object crossing a timezone boundary, which is how liturgical
 * apps traditionally get days wrong for users east of UTC.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function assertIsoDate(value, label = 'date') {
  if (!isIsoDate(value)) {
    const err = new Error(`Invalid ${label} "${value}". Expected format YYYY-MM-DD.`);
    err.status = 400;
    throw err;
  }
  return value;
}

/** Parse "YYYY-MM-DD" into a UTC-anchored Date used only for arithmetic. */
export function toUtcDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date) {
  return date.toISOString().slice(0, 10);
}

export function parts(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const dow = toUtcDate(iso).getUTCDay();
  return {
    year,
    month,
    day,
    dayOfWeek: dow,
    monthName: MONTHS[month - 1],
    dayName: WEEKDAYS[dow],
  };
}

export function monthName(monthNumber) {
  return MONTHS[monthNumber - 1];
}

export function dayName(iso) {
  return WEEKDAYS[toUtcDate(iso).getUTCDay()];
}

/** "DECEMBER 04, 2024" - the header line of every missalette page. */
export function formatHeaderDate(iso) {
  const p = parts(iso);
  return `${p.monthName.toUpperCase()} ${String(p.day).padStart(2, '0')}, ${p.year}`;
}

/** "December 04, 2024" - used in UI copy and progress messages. */
export function formatLongDate(iso) {
  const p = parts(iso);
  return `${p.monthName} ${String(p.day).padStart(2, '0')}, ${p.year}`;
}

/** USCCB endpoint slug: 2024-12-04 -> "120424". */
export function toUsccbSlug(iso) {
  const p = parts(iso);
  return (
    String(p.month).padStart(2, '0') +
    String(p.day).padStart(2, '0') +
    String(p.year % 100).padStart(2, '0')
  );
}

/** READINGS-December-04-2024-Wednesday.docx */
export function readingsFileName(iso, extension = 'docx') {
  const p = parts(iso);
  return `READINGS-${p.monthName}-${String(p.day).padStart(2, '0')}-${p.year}-${p.dayName}.${extension}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Every ISO date in a month, optionally filtered to specific weekday numbers. */
export function datesInMonth(year, month, { weekdays = null } = {}) {
  const total = daysInMonth(year, month);
  const out = [];
  for (let day = 1; day <= total; day += 1) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (weekdays && !weekdays.includes(toUtcDate(iso).getUTCDay())) continue;
    out.push(iso);
  }
  return out;
}

/** Nth occurrence of a weekday in a month, e.g. the First Friday. */
export function nthWeekdayOfMonth(year, month, weekday, nth) {
  const matches = datesInMonth(year, month, { weekdays: [weekday] });
  return matches[nth - 1] ?? null;
}

export function addDays(iso, amount) {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + amount);
  return toIso(d);
}

export function sortUnique(dates) {
  return [...new Set(dates)].sort();
}

export const MONTH_NAMES = MONTHS;
export const WEEKDAY_NAMES = WEEKDAYS;
