import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../api';
import { MONTH_NAMES, WEEKDAY_SHORT, monthGrid, parseIso, todayIso } from '../lib/dates';
import { cx } from './ui';

const DOT_COLORS = {
  GREEN: 'bg-emerald-600',
  PURPLE: 'bg-violet-600',
  RED: 'bg-red-600',
  ROSE: 'bg-pink-400',
  WHITE: 'bg-stone-300',
  GOLD: 'bg-amber-500',
  BLACK: 'bg-stone-700',
};

/**
 * Month grid coloured by liturgical season, used by every tab.
 *
 * `mode`:
 *   "single" - clicking a day selects it
 *   "multi"  - clicking toggles the day in `selected`
 */
export default function LiturgicalCalendar({
  year,
  month,
  onNavigate,
  selected = [],
  onSelect,
  mode = 'single',
  onDaysLoaded,
  className,
}) {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .month(year, month)
      .then((payload) => {
        if (cancelled) return;
        const byDate = Object.fromEntries(payload.days.map((day) => [day.date, day]));
        setDays(byDate);
        if (onDaysLoaded) onDaysLoaded(payload.days);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // onDaysLoaded is intentionally excluded: callers pass an inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const today = todayIso();

  const step = (delta) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    onNavigate(next.getUTCFullYear(), next.getUTCMonth() + 1);
  };

  return (
    <div className={cx('select-none', className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-stone-900">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          {loading && <Loader2 className="size-4 animate-spin text-stone-400" />}
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="pb-1 text-xs font-medium tracking-wide text-stone-400 uppercase">
            {label.slice(0, 2)}
          </div>
        ))}

        {cells.map((iso, index) => {
          if (!iso) return <div key={`blank-${index}`} />;

          const day = days[iso];
          const { day: dayNumber, weekday } = parseIso(iso);
          const isSelected = selectedSet.has(iso);
          const isToday = iso === today;
          const colorKey = day && day.celebration.color.key;
          const isFeast =
            day && ['SOLEMNITY', 'FEAST'].includes(day.celebration.rank);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect && onSelect(iso)}
              title={day ? `${day.occasionTitle} — ${day.celebration.rankLabel}` : iso}
              className={cx(
                'group relative flex aspect-square flex-col items-center justify-center rounded-lg text-base transition-colors',
                isSelected
                  ? 'bg-stone-900 font-semibold text-white'
                  : cx(
                      'hover:bg-stone-200/70',
                      weekday === 0 ? 'text-stone-400' : 'text-stone-800',
                    ),
                isToday && !isSelected && 'ring-1 ring-amber-500',
              )}
            >
              <span className={cx(isFeast && !isSelected && 'font-semibold')}>{dayNumber}</span>
              <span
                className={cx(
                  'mt-1 h-1.5 w-1.5 rounded-full',
                  isSelected ? 'bg-white/70' : DOT_COLORS[colorKey] || 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>

      {mode === 'multi' && (
        <p className="mt-3 text-sm text-stone-500">
          Click a date to add or remove it from the queue.
        </p>
      )}
    </div>
  );
}
