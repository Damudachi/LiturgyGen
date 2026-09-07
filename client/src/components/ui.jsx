import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, X } from 'lucide-react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary: 'bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-400',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-200/70 disabled:text-stone-300',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300',
  accent: 'bg-amber-700 text-white hover:bg-amber-800 disabled:bg-amber-300',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  ...props
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };
  // The icon grows with the label so a large button does not read as a small
  // one with too much padding round it.
  const iconSize = size === 'lg' ? 'size-5' : 'size-4';
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cx(iconSize, 'animate-spin')} />
      ) : Icon ? (
        <Icon className={iconSize} />
      ) : null}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, className, bodyClassName, children }) {
  return (
    <section className={cx('rounded-xl bg-white shadow-sm ring-1 ring-stone-200', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-stone-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Folds away everything the office does not need on an ordinary day. The point
 * is that the common path - pick a date, download - is the only thing visible
 * until someone deliberately asks for more.
 */
export function Disclosure({ label, hint, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx('rounded-xl bg-white shadow-sm ring-1 ring-stone-200', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cx(
          'flex w-full items-center gap-2 px-4 py-3 text-left',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-inset',
        )}
      >
        <ChevronRight
          className={cx('size-4 shrink-0 text-stone-400 transition-transform', open && 'rotate-90')}
        />
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {hint && <span className="truncate text-xs text-stone-400">{hint}</span>}
      </button>
      {open && <div className="border-t border-stone-200 p-4">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, htmlFor, children, className }) {
  return (
    <label htmlFor={htmlFor} className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium tracking-wide text-stone-600 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 ' +
  'placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600';

export function Input({ className, ...props }) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} {...props} className={cx(CONTROL, 'resize-y', className)} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select {...props} className={cx(CONTROL, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, className, ...props }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5', className)}>
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-4 shrink-0 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
      />
      <span className="min-w-0">
        <span className="block text-sm text-stone-800">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

const BADGE_TONES = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  rose: 'bg-pink-50 text-pink-800 ring-pink-200',
  white: 'bg-stone-50 text-stone-600 ring-stone-300',
  gold: 'bg-amber-50 text-amber-800 ring-amber-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone] || BADGE_TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map a romcal colour key onto a badge tone. */
export function toneForColor(colorKey) {
  return (
    {
      GREEN: 'green',
      PURPLE: 'violet',
      RED: 'red',
      ROSE: 'rose',
      WHITE: 'white',
      GOLD: 'gold',
      BLACK: 'neutral',
    }[colorKey] || 'neutral'
  );
}

const ALERT_TONES = {
  info: { cls: 'bg-sky-50 text-sky-900 ring-sky-200', Icon: Info },
  warn: { cls: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: AlertTriangle },
  error: { cls: 'bg-red-50 text-red-900 ring-red-200', Icon: AlertTriangle },
  success: { cls: 'bg-emerald-50 text-emerald-900 ring-emerald-200', Icon: CheckCircle2 },
};

export function Alert({ tone = 'info', title, onDismiss, children, className }) {
  const { cls, Icon } = ALERT_TONES[tone] || ALERT_TONES.info;
  return (
    <div className={cx('flex gap-3 rounded-lg p-3 text-sm ring-1 ring-inset', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-1', 'leading-relaxed')}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('size-4 animate-spin text-stone-400', className)} />;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="size-8 text-stone-300" />}
      <p className="text-sm font-medium text-stone-700">{title}</p>
      {children && <p className="max-w-sm text-xs text-stone-500">{children}</p>}
    </div>
  );
}
