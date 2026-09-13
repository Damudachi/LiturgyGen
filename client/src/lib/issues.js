/**
 * Where each chosen day stands before (and after) the files are made, so the
 * days that need a look are visible without opening them one by one.
 * Pure functions only; no React.
 */

/**
 * One day's standing, from its /readings/check entry and, if a run has
 * reached it, that run's result. A check that has the readings is the freshest
 * word - it follows corrections made after the run - so it wins.
 *
 *   state: 'failed' | 'issues' | 'ok' | 'unfetched' | 'unknown'
 */
export function dayStatus(check, result) {
  if (check && check.fetched) {
    return {
      state: check.warnings.length ? 'issues' : 'ok',
      messages: check.warnings,
      unfetched: false,
      refetchable: Boolean(check.refetchable),
    };
  }
  if (result && !result.ok) return { state: 'failed', messages: [result.error], unfetched: true, refetchable: true };
  if (result && result.ok) {
    return { state: result.warnings.length ? 'issues' : 'ok', messages: result.warnings, unfetched: false, refetchable: false };
  }
  if (check) {
    return { state: check.warnings.length ? 'issues' : 'unfetched', messages: check.warnings, unfetched: true, refetchable: true };
  }
  return { state: 'unknown', messages: [], unfetched: false, refetchable: false };
}

export const needsLook = (status) => status.state === 'issues' || status.state === 'failed';

/** The chosen days, those needing a look first, then by date. */
export function sortByNeed(dates, statusOf) {
  return [...dates].sort((a, b) => Number(needsLook(statusOf(b))) - Number(needsLook(statusOf(a))) || a.localeCompare(b));
}

/**
 * Days worth fetching before making the files: never fetched, or held as a
 * partial copy from the fallback feed that the readings website may complete.
 */
export function datesToFetch(dates, statusOf) {
  return dates.filter((iso) => {
    const status = statusOf(iso);
    return status.unfetched || (status.refetchable && status.state === 'issues');
  });
}

/** Merge a /readings/check response into what is known. */
export function mergeChecks(known, days) {
  return { ...known, ...Object.fromEntries(days.map((day) => [day.date, day])) };
}
