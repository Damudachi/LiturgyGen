import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import api from '../../api';
import { MONTH_NAMES, monthGrid, parseIso, todayIso } from '../../lib/dates';
import { dayStatus, mergeChecks, needsLook } from '../../lib/issues';
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
  // Fetching readings only, so days can be checked before anything is made.
  const fetchJob = useBatchJob();
  const [checks, setChecks] = useState({});

  const refreshChecks = useCallback(async (dates) => {
    if (!dates.length) return;
    try {
      const payload = await api.checkDays(dates);
      setChecks((known) => mergeChecks(known, payload.days));
    } catch {
      /* the marks are a help, not a requirement; opening a day still shows everything */
    }
  }, []);

  const choosing = selecting || selection.length > 0;

  // While choosing days, mark the month's days that need a look.
  useEffect(() => {
    if (choosing) refreshChecks(monthGrid(cursor.year, cursor.month).filter(Boolean));
  }, [choosing, cursor.year, cursor.month, reloadKey, refreshChecks]);

  // Days added from another month (Scheduled Masses) are checked too.
  useEffect(() => {
    const unknown = selection.filter((iso) => !checks[iso]);
    if (unknown.length) refreshChecks(unknown);
  }, [selection, checks, refreshChecks]);

  // A run changes what is on hand; check its days again when it ends.
  const makeStatus = batch.job && batch.job.status;
  const fetchStatus = fetchJob.job && fetchJob.job.status;
  useEffect(() => {
    if (batch.finished) refreshChecks(batch.job.dates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeStatus]);
  useEffect(() => {
    if (fetchJob.finished) refreshChecks(fetchJob.job.dates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStatus]);

  const statusOf = useMemo(() => {
    // The later run's result wins where both reached a day.
    const runs = [batch.job, fetchJob.job].filter(Boolean).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
    const results = new Map(runs.flatMap((job) => job.results.map((result) => [result.date, result])));
    return (iso) => dayStatus(checks[iso], results.get(iso));
  }, [checks, batch.job, fetchJob.job]);

  const flagged = useMemo(
    () => (choosing ? new Set(monthGrid(cursor.year, cursor.month).filter((iso) => iso && needsLook(statusOf(iso)))) : null),
    [choosing, cursor.year, cursor.month, statusOf],
  );

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
  const showPanel = choosing || Boolean(batch.job);

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-[36rem] flex-col max-[1023px]:h-auto">
      <div className="flex min-h-0 flex-1 max-[1023px]:flex-col">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-6 pt-5 pb-5" aria-label="Month">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[32px] font-semibold text-ink" aria-live="polite">
              {MONTH_NAMES[cursor.month - 1]} {cursor.year}
            </h1>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="lift grid size-10 cursor-pointer place-items-center rounded-full bg-tile text-navy shadow-rest ring-1 ring-tile-edge hover:bg-tile-sun">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next month" className="lift grid size-10 cursor-pointer place-items-center rounded-full bg-tile text-navy shadow-rest ring-1 ring-tile-edge hover:bg-tile-sun">
                <ChevronRight className="size-5" />
              </button>
            </div>
            <button type="button" onClick={goToday} className="lift min-h-10 cursor-pointer rounded-full bg-tile px-4 text-sm font-medium text-navy shadow-rest ring-1 ring-tile-edge hover:bg-tile-sun">
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
          {flagged && flagged.size > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-gold text-ink ring-1 ring-gold-edge">
                <TriangleAlert className="size-3" strokeWidth={2.5} />
              </span>
              {flagged.size} {flagged.size === 1 ? 'day' : 'days'} this month {flagged.size === 1 ? 'needs' : 'need'} a look. Open one to see why.
            </p>
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
            flagged={flagged}
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
            fetchJob={fetchJob}
            statusOf={statusOf}
          />
        )}
      </div>

      {openIso && (
        <DayBook
          key={openIso}
          iso={openIso}
          settings={settings}
          templates={templates}
          onClose={() => {
            // Corrections made in the book change what the day needs.
            if (choosing) refreshChecks([openIso]);
            setOpenIso(null);
          }}
        />
      )}
    </div>
  );
}
