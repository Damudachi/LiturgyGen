import { Check, TriangleAlert } from 'lucide-react';
import { parseIso, todayIso } from '../../lib/dates';
import { isLiturgicalWhite, stripeClass, tileAriaLabel, tileLabel } from '../../lib/tiles';
import { cx } from '../ui';

/** One day of the month: colour stripe, date, and what the day keeps. */
export default function DayTile({ iso, day, ticked, current, flagged, focusable, onActivate, onKeyDown, tileRef }) {
  const { day: number, weekday } = parseIso(iso);
  const isToday = iso === todayIso();
  const label = tileLabel(day);

  return (
    <button
      ref={tileRef}
      type="button"
      tabIndex={focusable ? 0 : -1}
      onClick={() => onActivate(iso)}
      onKeyDown={onKeyDown}
      aria-label={tileAriaLabel(day, iso, { ticked, needsLook: flagged })}
      aria-pressed={ticked || undefined}
      title={label || undefined}
      className={cx(
        'lift group relative flex min-h-[4.5rem] cursor-pointer flex-col overflow-hidden rounded-lg px-2.5 pt-3 pb-2 text-left',
        ticked
          ? 'bg-[#c9d3e3] shadow-raise ring-2 ring-inset ring-navy'
          : current
            ? 'bg-[#fff3c9] shadow-raise ring-2 ring-inset ring-navy'
            : cx(weekday === 0 ? 'bg-tile-sun' : 'bg-tile', 'shadow-rest ring-1 ring-inset ring-tile-edge hover:ring-navy/40'),
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-x-0 top-0 h-[5px]',
          stripeClass(day),
          isLiturgicalWhite(day) && 'shadow-[inset_0_-1px_0_#c9b98e]',
        )}
      />
      <span className="flex items-baseline gap-1.5">
        <span className="text-lg leading-tight font-semibold text-ink">{number}</span>
        {isToday && <span className="text-[13px] font-bold text-navy">Today</span>}
      </span>
      {label && <span className={cx('mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted', flagged && 'pr-6')}>{label}</span>}
      {flagged && (
        <span aria-hidden="true" title="Needs a look" className="absolute right-2 bottom-2 grid size-6 place-items-center rounded-full bg-gold text-ink ring-1 ring-gold-edge">
          <TriangleAlert className="size-3.5" strokeWidth={2.5} />
        </span>
      )}
      {ticked && (
        <span aria-hidden="true" className="absolute top-2.5 right-2 grid size-6 place-items-center rounded-full bg-navy text-page">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
