import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api';
import { MONTH_NAMES, parseIso, todayIso } from '../../lib/dates';
import { addDates, removeDate, shortcutRequest, toggleDate } from '../../lib/selection';
import DayBook from '../day/DayBook';
import { Alert } from '../ui';
import MakingPanel from './MakingPanel';
import MonthGrid from './MonthGrid';
import SelectionShortcuts from './SelectionShortcuts';
import SelectSeveralButton from './SelectSeveralButton';
import useBatchJob from './useBatchJob';

/**
 * The month. Clicking a day opens its book; "Select several days" turns clicks
 * into ticks and brings in the panel that makes the files.
 */
export default function CalendarScreen({ settings, templates }) {
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseIso(todayIso());
    return { year, month };
  });
  const [daysByDate, setDaysByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [openIso, setOpenIso] = useState(null);
  const [lastOpenIso, setLastOpenIso] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState([]);
  const [shortcutBusy, setShortcutBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [intentions, setIntentions] = useState((settings.schoolWideIntentions || []).join('\n'));
  const batch = useBatchJob();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .month(cursor.year, cursor.month)
      .then((payload) => {
        if (cancelled) return;
        // Keep earlier months too, so the panel can name days chosen elsewhere.
        setDaysByDate((known) => ({ ...known, ...Object.fromEntries(payload.days.map((day) => [day.date, day])) }));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cursor.year, cursor.month, reloadKey]);

  const step = (delta) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };

  const goToday = () => {
    const { year, month } = parseIso(todayIso());
    setCursor({ year, month });
  };

  const openDay = useCallback((iso) => {
    setOpenIso(iso);
    setLastOpenIso(iso);
  }, []);

  const activate = (iso) => {
    if (selecting) setSelection((current) => toggleDate(current, iso));
    else openDay(iso);
  };

  const withShortcut = async (fn) => {
    setShortcutBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setShortcutBusy(false);
    }
  };

  useEffect(() => {
    if (!selecting || openIso) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSelecting(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting, openIso]);

  const ticked = useMemo(() => new Set(selection), [selection]);
  const showPanel = selecting || selection.length > 0 || Boolean(batch.job);

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-[36rem] flex-col max-[1023px]:h-auto">
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-6 pt-5 pb-5" aria-label="Month">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[32px] font-semibold text-ink" aria-live="polite">
              {MONTH_NAMES[cursor.month - 1]} {cursor.year}
            </h1>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="grid size-10 cursor-pointer place-items-center rounded-full bg-tile text-navy ring-1 ring-tile-edge hover:bg-tile-sun">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next month" className="grid size-10 cursor-pointer place-items-center rounded-full bg-tile text-navy ring-1 ring-tile-edge hover:bg-tile-sun">
                <ChevronRight className="size-5" />
              </button>
            </div>
            <button type="button" onClick={goToday} className="min-h-10 cursor-pointer rounded-full bg-tile px-4 text-sm font-medium text-navy ring-1 ring-tile-edge hover:bg-tile-sun">
              Today
            </button>
            <div className="flex-1" />
            <SelectSeveralButton selecting={selecting} count={selection.length} onToggle={() => setSelecting((on) => !on)} />
          </div>

          {selecting && (
            <SelectionShortcuts
              busy={shortcutBusy}
              canClear={selection.length > 0}
              onShortcut={(id) =>
                withShortcut(async () => {
                  const payload = await api.expand(shortcutRequest(id, cursor.year, cursor.month));
                  setSelection((current) => addDates(current, payload.dates));
                })
              }
              onScheduled={() =>
                withShortcut(async () => {
                  const payload = await api.schedule();
                  if (!payload.scheduled.length) throw new Error('No Masses are saved as your schedule yet. Choose days, then "Save these dates as our Mass schedule".');
                  setSelection((current) => addDates(current, payload.scheduled.map((row) => row.date)));
                })
              }
              onClear={() => setSelection([])}
            />
          )}
          {notice && (
            <Alert tone="warn" onDismiss={() => setNotice(null)}>
              {notice}
            </Alert>
          )}

          <MonthGrid
            year={cursor.year}
            month={cursor.month}
            days={daysByDate}
            loading={loading}
            error={error}
            onRetry={() => setReloadKey((key) => key + 1)}
            ticked={ticked}
            currentIso={lastOpenIso}
            onActivate={activate}
          />
        </section>

        {showPanel && (
          <MakingPanel
            selection={selection}
            daysByDate={daysByDate}
            onRemove={(iso) => setSelection((current) => removeDate(current, iso))}
            onOpenDay={openDay}
            intentions={intentions}
            onIntentionsChange={setIntentions}
            batch={batch}
          />
        )}
      </div>

      {openIso && <DayBook key={openIso} iso={openIso} settings={settings} templates={templates} onClose={() => setOpenIso(null)} />}
    </div>
  );
}
