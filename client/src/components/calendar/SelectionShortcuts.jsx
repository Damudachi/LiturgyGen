import { SHORTCUTS } from '../../lib/selection';
import { cx } from '../ui';

const chip =
  'inline-flex min-h-9 cursor-pointer items-center rounded-[5px] px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-50';

/** Weekdays, Mon Wed Fri, First Friday, Scheduled Masses, Clear. */
export default function SelectionShortcuts({ busy, onShortcut, onScheduled, onClear, canClear }) {
  return (
    <div className="animate-panel flex flex-wrap items-center gap-2" role="group" aria-label="Add days quickly">
      <span className="mr-1 text-sm font-medium text-muted">Add this month's</span>
      {SHORTCUTS.map((shortcut) => (
        <button
          key={shortcut.id}
          type="button"
          disabled={busy}
          onClick={() => onShortcut(shortcut.id)}
          className={cx(chip, 'bg-page text-navy ring-[#b9c0cc] hover:ring-navy/60')}
        >
          {shortcut.label}
        </button>
      ))}
      <button type="button" disabled={busy} onClick={onScheduled} className={cx(chip, 'bg-page text-navy ring-[#b9c0cc] hover:ring-navy/60')}>
        Scheduled Masses
      </button>
      <button
        type="button"
        disabled={busy || !canClear}
        onClick={onClear}
        className={cx(chip, 'text-navy ring-transparent hover:underline')}
      >
        Clear
      </button>
    </div>
  );
}
