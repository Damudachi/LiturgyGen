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
        'inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[5px] py-2.5 pr-5 pl-4 text-[17px] font-bold whitespace-nowrap transition-colors',
        selecting ? 'bg-navy text-white hover:bg-ink' : 'bg-gold text-ink hover:bg-[#eab51f]',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid size-5 place-items-center rounded-[3px] border-2',
          selecting ? 'border-gold bg-gold text-ink' : 'border-ink',
        )}
      >
        {selecting && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      {selecting ? 'Done selecting' : 'Select several days'}
      {selecting && (
        <span className="figures-lining rounded-[4px] bg-gold px-2 text-base text-ink" aria-label={`${count} chosen`}>
          {count}
        </span>
      )}
    </button>
  );
}
