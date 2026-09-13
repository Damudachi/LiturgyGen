import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, X } from 'lucide-react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary: 'bg-navy text-white hover:bg-ink disabled:bg-muted/50',
  secondary: 'bg-page text-navy ring-1 ring-inset ring-[#b9c0cc] hover:bg-page-hi hover:ring-navy/60 disabled:text-muted/60',
  ghost: 'text-navy hover:bg-navy/[0.06] disabled:text-muted/50',
  danger: 'bg-bad text-white hover:bg-[#8e1d17] disabled:bg-bad/40',
  /* Gold is for the one thing on screen that matters most. */
  gold: 'bg-gold text-ink hover:bg-[#eab51f] disabled:opacity-50',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  pill = false,
  className,
  children,
  ...props
}) {
  const sizes = {
    sm: 'min-h-9 px-3 text-sm gap-1.5',
    md: 'min-h-10 px-4 text-base gap-2',
    lg: 'min-h-12 px-6 text-[17px] gap-2.5 font-bold',
  };
  const iconSize = size === 'lg' ? 'size-5' : 'size-4';
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed',
        'rounded-[5px]',
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary,
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className={cx(iconSize, 'animate-spin')} /> : Icon ? <Icon className={iconSize} /> : null}
      {children}
    </button>
  );
}

/** A text action inside running copy: "Edit this page", "Use other prayers". */
export function LinkButton({ className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'cursor-pointer text-sm font-semibold text-navy underline decoration-navy/35 underline-offset-4 hover:decoration-navy disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, className, bodyClassName, children }) {
  return (
    <section className={cx('rounded-md bg-page ring-1 ring-edge', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-serif text-[21px] font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Disclosure({ label, hint, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx('rounded-[5px] bg-page ring-1 ring-edge', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left"
      >
        <ChevronRight className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-90')} />
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && <span className="truncate text-sm text-muted">{hint}</span>}
      </button>
      {open && <div className="border-t border-edge p-4">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, htmlFor, children, className }) {
  return (
    <label htmlFor={htmlFor} className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-[5px] bg-page px-3 py-2 text-base text-ink ring-1 ring-inset ring-[#b9c0cc] ' +
  'placeholder:text-muted/70 hover:ring-navy/50 focus:ring-2 focus:ring-navy focus:outline-none';

export function Input({ className, ...props }) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} {...props} className={cx(CONTROL, 'resize-y leading-normal', className)} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select {...props} className={cx(CONTROL, 'cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, className, ...props }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3', className)}>
      <input type="checkbox" {...props} className="mt-1 size-4 shrink-0 cursor-pointer accent-navy" />
      <span className="min-w-0">
        <span className="block text-base text-ink">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

const BADGE_TONES = {
  neutral: 'bg-tile text-navy ring-tile-edge',
  green: 'bg-[#e3efe7] text-[#1f5a38] ring-[#bcd8c6]',
  violet: 'bg-[#efe8fb] text-[#4c1d95] ring-[#d6c7f3]',
  red: 'bg-[#f7e3e1] text-[#8e1d17] ring-[#e8bdb8]',
  rose: 'bg-[#fbe7ef] text-[#8f2f55] ring-[#f0c3d5]',
  white: 'bg-page-hi text-muted ring-edge',
  gold: 'bg-note text-note-ink ring-[#ead9a0]',
  amber: 'bg-note text-note-ink ring-[#ead9a0]',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[4px] px-2 py-0.5 text-sm font-medium ring-1 ring-inset',
        BADGE_TONES[tone] || BADGE_TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function toneForColor(colorKey) {
  return { GREEN: 'green', PURPLE: 'violet', RED: 'red', ROSE: 'rose', WHITE: 'white', GOLD: 'gold' }[colorKey] || 'neutral';
}

/* Directions and problems in rubric red, the rest in the page's own ink. */
const ALERT_TONES = {
  info: { cls: 'bg-page text-ink ring-edge border-l-[3px] border-navy', Icon: Info },
  warn: { cls: 'bg-note text-note-ink ring-[#ecd3d0] border-l-[3px] border-rubric', Icon: AlertTriangle },
  warning: { cls: 'bg-note text-note-ink ring-[#ecd3d0] border-l-[3px] border-rubric', Icon: AlertTriangle },
  error: { cls: 'bg-note text-note-ink ring-[#ecd3d0] border-l-[3px] border-rubric', Icon: AlertTriangle },
  success: { cls: 'bg-[#eef6f1] text-[#1f5a38] ring-[#cfe3d6] border-l-[3px] border-ok', Icon: CheckCircle2 },
};

export function Alert({ tone = 'info', title, onDismiss, children, className }) {
  const { cls, Icon } = ALERT_TONES[tone] || ALERT_TONES.info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-r-[5px] p-3 text-sm ring-1 ring-inset', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-normal">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-1')}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 cursor-pointer opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** A note on a book page, set like a rubric: a red rule and the direction beside it. */
export function Note({ children, className }) {
  return (
    <div className={cx('border-l-[3px] border-rubric py-1 pr-2 pl-3.5 text-sm leading-normal text-note-ink', className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('size-4 animate-spin text-muted', className)} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon className="size-8 text-tile-edge" aria-hidden="true" />}
      <p className="font-serif text-[21px] font-bold text-ink">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}
