import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { MONTH_NAMES, WEEKDAY_SHORT, monthGrid, todayIso } from '../../lib/dates';
import { moveFocus } from '../../lib/tiles';
import { Button, Spinner } from '../ui';
import DayTile from './DayTile';

/**
 * The month as tiles. Arrow keys move between days; Enter or a click activates
 * (opens the book, or ticks the day while selecting several).
 */
export default function MonthGrid({ year, month, days, loading, error, onRetry, ticked, currentIso, onActivate }) {
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const refs = useRef([]);
  const defaultIndex = () => {
    const wanted = [currentIso, todayIso()].map((iso) => cells.indexOf(iso)).find((index) => index >= 0);
    return wanted ?? cells.findIndex(Boolean);
  };
  const [focusIndex, setFocusIndex] = useState(defaultIndex);

  useEffect(() => {
    setFocusIndex(defaultIndex());
    // Re-anchor only when the month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);

  const onKeyDown = (index) => (event) => {
    const next = moveFocus(cells, index, event.key);
    if (next !== index) {
      event.preventDefault();
      setFocusIndex(next);
      refs.current[next]?.focus();
    }
  };

  const rows = cells.length / 7;

  if (error) {
    return (
      <div className="grid flex-1 place-items-center rounded-lg bg-tile/60 p-8 text-center">
        <div>
          <p className="font-serif text-xl font-semibold">
            Could not load {MONTH_NAMES[month - 1]} {year}
          </p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Button className="mt-4" icon={RotateCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 gap-1.5 pb-1.5" aria-hidden="true">
        {WEEKDAY_SHORT.map((name) => (
          <div key={name} className="pl-2 text-[13px] font-medium text-muted">
            {name}
          </div>
        ))}
      </div>
      <div
        role="grid"
        aria-label={`${MONTH_NAMES[month - 1]} ${year}`}
        className="grid min-h-0 flex-1 grid-cols-7 gap-1.5"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(4.5rem, 1fr))` }}
      >
        {cells.map((iso, index) =>
          iso ? (
            <DayTile
              key={iso}
              iso={iso}
              day={days[iso]}
              ticked={ticked.has(iso)}
              current={iso === currentIso}
              focusable={index === focusIndex}
              onActivate={(date) => {
                setFocusIndex(index);
                onActivate(date);
              }}
              onKeyDown={onKeyDown(index)}
              tileRef={(node) => {
                refs.current[index] = node;
              }}
            />
          ) : (
            <div key={`blank-${index}`} aria-hidden="true" />
          ),
        )}
      </div>
      {loading && (
        <div className="pointer-events-none absolute top-0 right-0 flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading
        </div>
      )}
    </div>
  );
}
