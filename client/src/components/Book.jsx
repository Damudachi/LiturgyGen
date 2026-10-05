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
        'book-gutter relative grid rounded-[10px] bg-page shadow-book outline-none min-[900px]:grid-cols-2 min-[900px]:grid-rows-[minmax(0,1fr)]',
        overlay && 'animate-book h-full rounded-b-none max-[899px]:overflow-y-auto',
        className,
      )}
    >
      <div aria-hidden="true" className="ribbon pointer-events-none absolute -top-2 left-5 z-10 h-28 w-5 bg-gold" />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-page-hi px-3.5 text-sm font-medium text-navy ring-1 ring-edge hover:bg-tile"
        >
          <X className="size-4" aria-hidden="true" />
          Close book
        </button>
      )}
      {/*
        * The two pages scroll independently, so nothing is ever unreachable -
        * but a full Liturgy of the Word is longer than any screen, and every
        * row of padding is a row of scripture the reader has to scroll for.
        *
        * WHICH PAGE PAYS FOR THE CLOSE BUTTON
        * ------------------------------------
        * The button is pinned to the book's top right, so the page that needs
        * 48px of clearance above it (top-3 plus min-h-9) is whichever page is up
        * there - and that changes with the layout. Side by side it is the right
        * page; stacked on a phone the right page has moved below the left, and
        * the button is over the LEFT one. So the clearance belongs to the left
        * page below 900px and to the right page above it, which is why the two
        * pt values trade places at the breakpoint rather than being fixed.
        *
        * The ribbon hangs down the far left (left-5, w-5, so out to 40px) over
        * the top 112px of the book. pl-14 clears it on a wide screen; stacked,
        * the left page's own padding has to clear it too, hence pl-11 - at the
        * old px-8 the first lines of the day's title ran underneath it.
        */}
      <div className="min-h-0 overflow-y-auto scroll-slim pt-12 pr-8 pb-6 pl-11 min-[900px]:pt-7 min-[900px]:pr-10 min-[900px]:pl-14">
        {left}
      </div>
      <div className="min-h-0 overflow-y-auto scroll-slim border-t border-edge px-8 pt-7 pb-6 min-[900px]:border-t-0 min-[900px]:pt-12 min-[900px]:pr-14 min-[900px]:pl-10">
        {right}
      </div>
    </div>
  );

  if (!overlay) return book;

  return (
    // pt-3 rather than pt-6: the book is flush to the bottom already, so every
    // pixel above it is a pixel off both pages.
    //
    // Both edges come from the variables in index.css, so the book sits between
    // the navbar and - on a phone - the bottom tab bar, rather than running
    // underneath either. px-2 on the narrowest screens: at px-4 the two 32px
    // page gutters plus the margin left under 270px for a line of scripture.
    <div className="fixed inset-x-0 top-[var(--app-header)] bottom-[var(--app-nav)] z-40 flex justify-center px-2 pt-3 min-[480px]:px-4 sm:px-10">
      <div className="animate-dim absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-full max-w-[1280px]">{book}</div>
    </div>
  );
}
