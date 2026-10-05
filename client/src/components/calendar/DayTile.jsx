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
        // min-h must not exceed the grid row floor in MonthGrid, or the tile
        // wins and the month overflows its screen again. The two are a pair.
        // On a phone the tile is about 44px wide, so px-2.5 was spending nearly
        // half of it on padding; the date needs that room more than the edges do.
        'lift group relative flex min-h-[3.5rem] cursor-pointer flex-col overflow-hidden rounded-lg px-2.5 pt-2.5 pb-1.5 text-left max-sm:px-1 max-sm:pt-1.5 max-sm:pb-1',
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
      <span className="flex items-baseline gap-1.5 max-sm:justify-center">
        <span
          className={cx(
            'text-lg leading-tight font-semibold text-ink',
            // The word "Today" does not fit beside the date on a phone, so there
            // today is marked the way a wall calendar marks it: the date itself
            // is circled.
            isToday && 'max-sm:grid max-sm:size-[1.45rem] max-sm:place-items-center max-sm:rounded-full max-sm:bg-navy max-sm:text-[15px] max-sm:text-page',
          )}
        >
          {number}
        </span>
        {isToday && <span className="text-[13px] font-bold text-navy max-sm:hidden">Today</span>}
      </span>
      {label && <span className={cx('tile-label mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted', flagged && 'pr-6')}>{label}</span>}

      {/*
        * The foot of the phone's tile. With the day's name gone it carries the
        * one thing still worth seeing at a glance, in the order you would act on
        * it: this day is chosen, or it needs a look, or it simply has something
        * on it. The screen reader is told all of this by tileAriaLabel either
        * way, so the mark is decoration.
        *
        * Written as `flex sm:hidden` rather than a max-sm: variant because it
        * sets display, and the positive direction leaves no doubt which rule
        * wins.
        */}
      <span aria-hidden="true" className="mt-auto flex items-center justify-center sm:hidden">
        {ticked ? (
          <Check className="size-3.5 text-navy" strokeWidth={3} />
        ) : flagged ? (
          <TriangleAlert className="size-3.5 text-gold-edge" strokeWidth={2.5} />
        ) : label ? (
          <span className="size-1.5 rounded-full bg-muted/45" />
        ) : null}
      </span>

      {/* The full badges, from sm up, where there is width for them. */}
      {flagged && (
        <span aria-hidden="true" title="Needs a look" className="absolute right-2 bottom-2 hidden size-6 place-items-center rounded-full bg-gold text-ink ring-1 ring-gold-edge sm:grid">
          <TriangleAlert className="size-3.5" strokeWidth={2.5} />
        </span>
      )}
      {ticked && (
        <span aria-hidden="true" className="absolute top-2.5 right-2 hidden size-6 place-items-center rounded-full bg-navy text-page sm:grid">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
