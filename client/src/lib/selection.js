/**
 * The days ticked in "Select several days". Always a sorted array of unique
 * ISO dates, so it can go straight to the batch API and survives moving
 * between months. Pure functions only; no React.
 */

const normalise = (dates) => [...new Set(dates)].sort();

export function toggleDate(selection, iso) {
  return selection.includes(iso) ? selection.filter((date) => date !== iso) : normalise([...selection, iso]);
}

export function addDates(selection, dates) {
  return normalise([...selection, ...dates]);
}

export function removeDate(selection, iso) {
  return selection.filter((date) => date !== iso);
}

/** Days of one month in the selection, e.g. to tick tiles on screen. */
export function datesInMonth(selection, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return selection.filter((date) => date.startsWith(prefix));
}

/** The shortcut buttons, as the server's /calendar/expand request for a month. */
export const SHORTCUTS = [
  { id: 'weekdays', label: 'Weekdays', spec: { mode: 'custom', weekdays: [1, 2, 3, 4, 5] } },
  { id: 'mwf', label: 'Mon, Wed, Fri', spec: { mode: 'custom', weekdays: [1, 3, 5] } },
  { id: 'first-friday', label: 'First Friday', spec: { mode: 'custom', weekdays: [], nthWeekdays: [{ weekday: 5, nth: 1 }] } },
];

export function shortcutRequest(shortcutId, year, month) {
  const shortcut = SHORTCUTS.find((entry) => entry.id === shortcutId);
  if (!shortcut) throw new Error(`Unknown shortcut: ${shortcutId}`);
  return { year, month, ...shortcut.spec };
}

export function countLabel(count) {
  return `${count} ${count === 1 ? 'day' : 'days'} chosen`;
}
