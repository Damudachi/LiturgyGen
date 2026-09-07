import { Router } from 'express';
import {
  datesInMonth,
  isIsoDate,
  monthName,
  nthWeekdayOfMonth,
  sortUnique,
  WEEKDAY_NAMES,
} from '../lib/dates.js';
import { getLiturgicalDay, getMonth } from '../services/calendarService.js';

const router = Router();

const asInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

/** Colour-coded month grid for the calendar pickers. */
router.get('/month/:year/:month', async (req, res, next) => {
  try {
    const year = asInt(req.params.year);
    const month = asInt(req.params.month);
    if (!year || year < 1970 || year > 2100) return res.status(400).json({ error: 'Year must be between 1970 and 2100.' });
    if (!month || month < 1 || month > 12) return res.status(400).json({ error: 'Month must be 1-12.' });

    const days = await getMonth(year, month);
    res.json({ year, month, monthName: monthName(month), days });
  } catch (error) {
    next(error);
  }
});

router.get('/day/:date', async (req, res, next) => {
  try {
    if (!isIsoDate(req.params.date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    res.json(await getLiturgicalDay(req.params.date));
  } catch (error) {
    next(error);
  }
});

/**
 * Expand a month + filter into a list of dates - what the Batch tab's quick
 * filters ("All Weekdays", "First Fridays") post before starting a job.
 *
 *   { year, month, mode: "weekdays" | "all" | "custom",
 *     weekdays: [1,2,3,4,5], nthWeekdays: [{ weekday: 5, nth: 1 }] }
 */
router.post('/expand', (req, res) => {
  const { year, month, mode = 'weekdays', weekdays, nthWeekdays } = req.body || {};
  const y = asInt(year);
  const m = asInt(month);
  if (!y || !m || m < 1 || m > 12) return res.status(400).json({ error: 'Provide a valid year and month.' });

  let dates = [];

  if (mode === 'all') {
    dates = datesInMonth(y, m);
  } else if (mode === 'custom') {
    const selected = Array.isArray(weekdays) ? weekdays.map(Number).filter((d) => d >= 0 && d <= 6) : [];
    if (selected.length) dates = datesInMonth(y, m, { weekdays: selected });
    for (const rule of Array.isArray(nthWeekdays) ? nthWeekdays : []) {
      const iso = nthWeekdayOfMonth(y, m, Number(rule.weekday), Number(rule.nth));
      if (iso) dates.push(iso);
    }
  } else {
    dates = datesInMonth(y, m, { weekdays: [1, 2, 3, 4, 5] });
  }

  res.json({
    year,
    month: m,
    monthName: monthName(m),
    mode,
    dates: sortUnique(dates),
    weekdayNames: WEEKDAY_NAMES,
  });
});

export default router;
