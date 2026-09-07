export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toIso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

export function formatLong(iso) {
  const { year, month, day, weekday } = parseIso(iso);
  return `${WEEKDAY_NAMES[weekday]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatShort(iso) {
  const { month, day } = parseIso(iso);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}`;
}

export function formatHeader(iso) {
  const { year, month, day } = parseIso(iso);
  return `${MONTH_NAMES[month - 1].toUpperCase()} ${String(day).padStart(2, '0')}, ${year}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Leading blanks so the 1st lands under the right weekday column. */
export function monthGrid(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const total = daysInMonth(year, month);
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= total; day += 1) cells.push(toIso(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
