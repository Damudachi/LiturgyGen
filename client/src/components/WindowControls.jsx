import { useEffect, useState } from 'react';
import { cx } from './ui';

/**
 * In the office's desktop window (desktop/launcher) the navbar is the title bar:
 * drag it to move the window, double-click it to maximize, and use the window
 * buttons at its right end. The launcher does the moving; the page only says
 * what was pressed, through WebView2's message channel. In a browser tab there
 * is no channel, and none of this appears.
 */

const channel = typeof window !== 'undefined' && window.chrome && window.chrome.webview ? window.chrome.webview : null;

export const inDesktopWindow = Boolean(channel);

const send = (message) => channel && channel.postMessage(message);

/** Whether the desktop window is maximized, as the launcher reports it. */
export function useWindowState() {
  const [state, setState] = useState({ maximized: false });

  useEffect(() => {
    if (!channel) return undefined;
    const onMessage = (event) => {
      if (event.data && event.data.type === 'window') setState({ maximized: Boolean(event.data.maximized) });
    };
    channel.addEventListener('message', onMessage);
    send('ready');
    return () => channel.removeEventListener('message', onMessage);
  }, []);

  return state;
}

/**
 * Props for the element that acts as the title bar. Controls inside it keep
 * their clicks; the bare bar moves the window.
 */
export function titleBarProps() {
  if (!channel) return {};
  return {
    onMouseDown(event) {
      if (event.button !== 0 || event.target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
      event.preventDefault();
      // The move loop swallows the second click, so a double-click is read here.
      send(event.detail === 2 ? 'toggle-maximize' : 'drag');
    },
  };
}

// Segoe Fluent Icons (Windows 11) and Segoe MDL2 Assets (Windows 10) share these,
// so the buttons are the ones Windows itself draws.
const GLYPH = { minimize: '', maximize: '', restore: '', close: '' };

function WindowButton({ label, glyph, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'grid h-full w-[46px] cursor-default place-items-center text-[10px] text-page/90 transition-colors',
        danger ? 'hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/80' : 'hover:bg-white/10 active:bg-white/15',
      )}
      style={{ fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"' }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/** Minimize, maximize and close, plus the window's top resize edge. Nothing in a browser. */
export default function WindowControls() {
  const { maximized } = useWindowState();
  if (!channel) return null;

  const edge = (message, className) => (
    <div
      aria-hidden="true"
      data-no-drag
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        send(message);
      }}
      className={cx('absolute top-0 z-10 h-[5px]', className)}
    />
  );

  return (
    <>
      {!maximized && (
        <>
          {edge('resize-top', 'inset-x-2 cursor-ns-resize')}
          {edge('resize-topleft', 'left-0 w-2 cursor-nwse-resize')}
          {edge('resize-topright', 'right-0 w-2 cursor-nesw-resize')}
        </>
      )}
      <div className="-mr-6 ml-2 flex h-full self-start" role="group" aria-label="Window">
        <WindowButton label="Minimize" glyph={GLYPH.minimize} onClick={() => send('minimize')} />
        <WindowButton
          label={maximized ? 'Restore' : 'Maximize'}
          glyph={maximized ? GLYPH.restore : GLYPH.maximize}
          onClick={() => send('toggle-maximize')}
        />
        <WindowButton label="Close" glyph={GLYPH.close} onClick={() => send('close')} danger />
      </div>
    </>
  );
}
