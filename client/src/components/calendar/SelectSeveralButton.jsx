import { Check } from 'lucide-react';
import { cx } from '../ui';

/**
 * The most noticeable control on the Calendar: gold while browsing, navy with a
 * count while selecting. Never hidden or collapsed.
 */
export default function SelectSeveralButton({ selecting, count, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selecting}
      className={cx(
        'lift inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl py-2.5 pr-5 pl-4 text-lg font-extrabold whitespace-nowrap',
        selecting
          ? 'bg-navy text-page shadow-[0_3px_0_#111a2e,0_8px_18px_rgba(38,53,81,0.35)] hover:bg-ink'
          : 'bg-gold text-ink shadow-[0_3px_0_var(--color-gold-edge),0_8px_18px_rgba(242,188,27,0.35)] hover:brightness-105',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid size-5 place-items-center rounded-[4px] border-[2.5px]',
          selecting ? 'border-gold bg-gold text-ink' : 'border-ink',
        )}
      >
        {selecting && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      {selecting ? 'Done selecting' : 'Select several days'}
      {selecting && (
        <span className="rounded-full bg-gold px-2 text-base text-ink" aria-label={`${count} chosen`}>
          {count}
        </span>
      )}
    </button>
  );
}
