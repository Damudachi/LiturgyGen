import { Check } from 'lucide-react';
import { parseIso, todayIso } from '../../lib/dates';
import { isLiturgicalWhite, rankClass, stripeClass, tileAriaLabel, tileLabel } from '../../lib/tiles';
import { cx } from '../ui';

/**
 * One day of the month, set like a line of the Ordo: the date, a swatch of the
 * liturgical colour, and the celebration in the weight its rank calls for.
 */
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
        'relative flex min-h-[4.5rem] cursor-pointer flex-col px-3 pt-2.5 pb-2 text-left transition-colors [outline-offset:-3px]',
        ticked ? 'bg-[#e4eaf5] hover:bg-[#dbe3f1]' : current ? 'bg-[#fdf5df]' : weekday === 0 ? 'bg-tile-sun hover:bg-[#eaedf3]' : 'bg-page hover:bg-page-hi',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'figures-lining font-serif leading-none',
            isToday ? '-mt-1 -ml-1.5 grid size-8 place-items-center rounded-full bg-navy text-[17px] font-bold text-white' : 'text-[22px] text-ink',
          )}
        >
          {number}
        </span>
        {day && (
          <span
            aria-hidden="true"
            className={cx('mt-0.5 size-2.5 shrink-0', stripeClass(day), isLiturgicalWhite(day) && 'ring-1 ring-[#9aa3b2] ring-inset')}
          />
        )}
      </span>

      {label && <span className={cx('mt-1.5 line-clamp-2 leading-snug', rankClass(day))}>{label}</span>}

      {(flagged || ticked) && (
        <span className="mt-auto flex items-end justify-between gap-2 pt-1">
          {flagged ? <span className="text-[12px] leading-tight font-semibold text-rubric">Needs a look</span> : <span />}
          {ticked && (
            <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-navy text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          )}
        </span>
      )}
    </button>
  );
}
