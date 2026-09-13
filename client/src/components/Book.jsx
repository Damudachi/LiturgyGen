import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cx } from './ui';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An open book: two paper pages, a gutter and the gold ribbon. It knows nothing
 * about liturgy; callers hand it the two pages.
 *
 * variant "overlay" dims what is behind it and behaves as a dialog (focus is
 * held inside, Escape or a click on the dim layer closes it, focus returns to
 * whatever opened it). variant "inline" simply sits in the layout.
 */
export default function Book({ variant = 'overlay', label, onClose, left, right, className }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const overlay = variant === 'overlay';

  useEffect(() => {
    if (!overlay) return undefined;
    const opener = document.activeElement;
    const node = panel.current;
    node?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [overlay]);

  const book = (
    <div
      ref={panel}
      role={overlay ? 'dialog' : 'region'}
      aria-modal={overlay || undefined}
      aria-label={label}
      tabIndex={-1}
      className={cx(
        'book-gutter relative grid rounded-md bg-page shadow-book outline-none min-[900px]:grid-cols-2 min-[900px]:grid-rows-[minmax(0,1fr)]',
        overlay && 'animate-book h-full rounded-b-none max-[899px]:overflow-y-auto',
        className,
      )}
    >
      <div aria-hidden="true" className="ribbon pointer-events-none absolute -top-1.5 left-6 z-10 h-24 w-4 bg-rubric" />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[5px] bg-page px-3 text-sm font-semibold text-navy ring-1 ring-[#b9c0cc] ring-inset hover:ring-navy/60"
        >
          <X className="size-4" aria-hidden="true" />
          Close book
        </button>
      )}
      <div className="min-h-0 overflow-y-auto scroll-slim px-8 pt-12 pb-8 min-[900px]:pr-10 min-[900px]:pl-14">{left}</div>
      <div className="min-h-0 overflow-y-auto scroll-slim border-t border-edge px-8 pt-12 pb-8 min-[900px]:border-t-0 min-[900px]:pr-14 min-[900px]:pl-10">
        {right}
      </div>
    </div>
  );

  if (!overlay) return book;

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-40 flex justify-center px-4 pt-6 sm:px-10">
      <div className="animate-dim absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-full max-w-[1280px]">{book}</div>
    </div>
  );
}
