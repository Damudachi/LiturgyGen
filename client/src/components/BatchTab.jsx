import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileStack,
  ListChecks,
  Play,
  Trash2,
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react';
import api from '../api';
import { WEEKDAY_NAMES, formatLong, formatShort, parseIso, todayIso } from '../lib/dates';
import LiturgicalCalendar from './LiturgicalCalendar';
import { Alert, Badge, Button, Card, Checkbox, Disclosure, EmptyState, Textarea, cx } from './ui';

const MODES = [
  { id: 'month', label: 'Whole month', icon: CalendarRange },
  { id: 'custom', label: 'Pick dates', icon: CalendarDays },
  { id: 'scheduled', label: 'Scheduled Masses', icon: ListChecks },
];

const QUICK_FILTERS = [
  { id: 'weekdays', label: 'All weekdays (Mon–Fri)', weekdays: [1, 2, 3, 4, 5] },
  { id: 'all', label: 'All days', weekdays: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'schooldays', label: 'Mon, Wed, Fri', weekdays: [1, 3, 5] },
];

export default function BatchTab({ settings }) {
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseIso(today);
    return { year, month };
  });

  const [mode, setMode] = useState('month');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [firstFridays, setFirstFridays] = useState(false);
  const [selected, setSelected] = useState([]);
  const [scheduled, setScheduled] = useState([]);

  const [extraIntentions, setExtraIntentions] = useState(
    (settings.schoolWideIntentions || []).join('\n'),
  );

  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState(null);
  const eventSource = useRef(null);

  /* ---------------------------------------------------------------- *
   * Building the date queue
   * ---------------------------------------------------------------- */

  const refreshMonthSelection = useCallback(async () => {
    const spec = {
      year: cursor.year,
      month: cursor.month,
      mode: 'custom',
      weekdays,
      nthWeekdays: firstFridays ? [{ weekday: 5, nth: 1 }] : [],
    };
    const payload = await api.expand(spec);
    setSelected(payload.dates);
  }, [cursor.year, cursor.month, weekdays, firstFridays]);

  useEffect(() => {
    if (mode === 'month') refreshMonthSelection().catch(() => {});
  }, [mode, refreshMonthSelection]);

  useEffect(() => {
    if (mode !== 'scheduled') return;
    api
      .schedule()
      .then((payload) => {
        setScheduled(payload.scheduled);
        setSelected(payload.scheduled.map((row) => row.date));
      })
      .catch((err) => setNotice({ tone: 'error', text: err.message }));
  }, [mode]);

  const toggleDate = (iso) => {
    setSelected((current) =>
      current.includes(iso) ? current.filter((date) => date !== iso) : [...current, iso].sort(),
    );
  };

  const toggleWeekday = (index) => {
    setWeekdays((current) =>
      current.includes(index) ? current.filter((d) => d !== index) : [...current, index].sort(),
    );
  };

  const applyQuickFilter = (filter) => {
    setMode('month');
    setFirstFridays(false);
    setWeekdays(filter.weekdays);
  };

  /* ---------------------------------------------------------------- *
   * Running the job
   * ---------------------------------------------------------------- */

  const closeStream = useCallback(() => {
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const start = async () => {
    if (!selected.length) return;
    setStarting(true);
    setNotice(null);
    closeStream();

    try {
      const started = await api.startBatch({
        dates: selected,
        extraIntentions: extraIntentions.split('\n').map((line) => line.trim()).filter(Boolean),
      });
      setJob(started);

      // Server-Sent Events give the "Processing date 4 of 22…" counter without polling.
      const source = new EventSource(`/api/batch/${started.id}/events`);
      eventSource.current = source;
      source.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        setJob(payload);
        if (['done', 'failed', 'cancelled'].includes(payload.status)) closeStream();
      };
      source.onerror = () => {
        // The stream ends when the job finishes; fall back to one poll.
        closeStream();
        api.batch(started.id).then(setJob).catch(() => {});
      };
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!job) return;
    await api.cancelBatch(job.id).catch(() => {});
  };

  const downloadZip = async () => {
    try {
      const name = await api.downloadZip(job.id);
      setNotice({ tone: 'success', text: `Downloaded ${name}` });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    }
  };

  const downloadCombined = async () => {
    try {
      const name = await api.downloadCombined(job.id);
      setNotice({ tone: 'success', text: `Downloaded ${name}` });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    }
  };

  const running = job && job.status === 'running';
  const finished = job && ['done', 'failed', 'cancelled'].includes(job.status);
  const percent = job && job.total ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0;

  const estimateSeconds = useMemo(() => Math.ceil((selected.length * 900) / 1000), [selected.length]);

  return (
    <div className="grid gap-4 lg:grid-cols-[28rem_minmax(0,1fr)]">
      {/* ---------------- left: selection ---------------- */}
      <div className="space-y-4">
        <Card title="How do you want to pick dates?" bodyClassName="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={cx(
                  'flex flex-col items-center gap-1.5 rounded-lg px-2 py-4 text-sm font-medium transition-colors',
                  mode === option.id
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                )}
              >
                <option.icon className="size-5" />
                <span className="text-center leading-tight">{option.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* One card for choosing days: the shortcuts, the calendar, and the
            weekday picker for the rare month that needs it. The calendar shows
            the month itself, so the card does not repeat it. */}
        <Card
          title={mode === 'custom' ? 'Click dates to queue them' : 'Choose the days'}
          subtitle={mode === 'scheduled' ? 'Showing your saved Mass schedule' : undefined}
        >
          {mode === 'month' && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {QUICK_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  size="sm"
                  variant={
                    weekdays.length === filter.weekdays.length &&
                    filter.weekdays.every((d) => weekdays.includes(d))
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => applyQuickFilter(filter)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          )}

          <LiturgicalCalendar
            year={cursor.year}
            month={cursor.month}
            onNavigate={(year, month) => setCursor({ year, month })}
            selected={selected}
            onSelect={mode === 'month' ? undefined : toggleDate}
            mode={mode === 'month' ? 'single' : 'multi'}
          />

          {mode === 'month' && (
            <Disclosure label="Choose specific weekdays" className="mt-3">
              <div className="grid grid-cols-4 gap-1.5">
                {WEEKDAY_NAMES.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleWeekday(index)}
                    className={cx(
                      'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      weekdays.includes(index)
                        ? 'bg-amber-700 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>

              <Checkbox
                className="mt-3"
                label="Also include the First Friday"
                checked={firstFridays}
                onChange={(event) => setFirstFridays(event.target.checked)}
              />
            </Disclosure>
          )}

          {mode === 'scheduled' && scheduled.length === 0 && (
            <p className="mt-3 text-xs text-stone-500">
              No Masses scheduled yet. Switch to “Pick dates”, choose the days, then save them as
              your schedule below.
            </p>
          )}
        </Card>

        <Disclosure
          label="School-wide intentions"
          hint={
            extraIntentions.trim()
              ? `${extraIntentions.trim().split('\n').filter(Boolean).length} added to every date`
              : 'none'
          }
        >
          <Textarea
            rows={4}
            value={extraIntentions}
            onChange={(event) => setExtraIntentions(event.target.value)}
            placeholder={'For the intentions of our benefactors\nFor the success of our patronal feast'}
          />
          <p className="mt-2 text-xs text-stone-500">
            One intention per line, added to every date in this batch. Leave blank for none.
          </p>
        </Disclosure>
      </div>

      {/* ---------------- right: queue + progress ---------------- */}
      <div className="space-y-4">
        {notice && (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}

        <Card
          title="Selected dates"
          subtitle={
            selected.length
              ? `${selected.length} date${selected.length === 1 ? '' : 's'} · about ${estimateSeconds}s to fetch`
              : 'Nothing queued yet'
          }
          actions={
            <>
              {mode !== 'month' && selected.length > 0 && (
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setSelected([])}>
                  Clear
                </Button>
              )}
              {mode === 'custom' && selected.length > 0 && (
                <Button
                  size="sm"
                  onClick={() =>
                    api
                      .addSchedule({ dates: selected })
                      .then(() => setNotice({ tone: 'success', text: 'Saved as your Mass schedule.' }))
                      .catch((err) => setNotice({ tone: 'error', text: err.message }))
                  }
                >
                  Save as schedule
                </Button>
              )}
              <Button
                variant="primary"
                icon={Play}
                onClick={start}
                loading={starting}
                disabled={!selected.length || running}
              >
                Generate {selected.length || ''}
              </Button>
            </>
          }
        >
          {selected.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No dates queued">
              Use the quick filters, or switch to “Pick dates” and click the days you need.
            </EmptyState>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((iso) => (
                <span
                  key={iso}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pr-1 pl-2.5 text-xs text-stone-700 ring-1 ring-stone-200"
                >
                  {formatShort(iso)}
                  <button
                    type="button"
                    onClick={() => toggleDate(iso)}
                    className="rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                    aria-label={`Remove ${iso}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>

        {job && (
          <Card
            title="Progress"
            subtitle={job.message}
            actions={
              running ? (
                <Button size="sm" variant="danger" icon={XCircle} onClick={cancel}>
                  Cancel
                </Button>
              ) : null
            }
          >
            <div className="mb-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className={cx(
                    'h-full rounded-full transition-all duration-300',
                    job.status === 'failed' ? 'bg-red-600' : 'bg-emerald-600',
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-stone-500">
                <span>
                  {job.completed} done · {job.failed} failed
                  {job.needsAttention > 0 && ` · ${job.needsAttention} need a look`} · {job.total}{' '}
                  total
                </span>
                <span>{percent}%</span>
              </div>
            </div>

            {finished && job.completed > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <Button variant="primary" icon={Archive} onClick={downloadZip}>
                  Download all as ZIP
                </Button>
                <Button variant="accent" icon={FileStack} onClick={downloadCombined}>
                  Download single master file
                </Button>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto rounded-lg ring-1 ring-stone-200 scroll-slim">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-stone-100">
                  {job.results.map((result) => (
                    <tr key={result.date} className={result.ok ? '' : 'bg-red-50/60'}>
                      <td className="w-8 py-2 pl-3">
                        {result.ok ? (
                          result.warnings.length ? (
                            <TriangleAlert className="size-4 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          )
                        ) : (
                          <XCircle className="size-4 text-red-600" />
                        )}
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-stone-600">
                        {formatLong(result.date)}
                      </td>
                      <td className="py-2 pr-3 text-stone-800">
                        {result.ok ? (
                          <>
                            <span className="font-medium">{result.occasionTitle}</span>
                            {result.warnings.length > 0 && (
                              <span className="mt-0.5 block text-amber-700">
                                {result.warnings.join(' ')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-red-800">{result.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {running && job.currentDate && (
                    <tr>
                      <td className="py-2 pl-3">
                        <span className="block size-2 animate-pulse rounded-full bg-amber-500" />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-stone-500">
                        {formatLong(job.currentDate)}
                      </td>
                      <td className="py-2 pr-3 text-stone-500">Fetching…</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {finished && job.failed > 0 && (
              <Alert tone="warn" className="mt-3" title={`${job.failed} date(s) could not be built`}>
                Open each one in the Single Date tab to import its readings, then run those dates
                again. The ZIP includes a NOT-GENERATED.txt listing them.
              </Alert>
            )}
          </Card>
        )}

        {!job && (
          <Card title="How it works">
            <ol className="space-y-2 text-sm text-stone-600">
              <li>
                <Badge>1</Badge> Pick the dates you need.
              </li>
              <li>
                <Badge>2</Badge> LiturgyGen looks up each day and collects its readings and
                prayers. This takes a moment per day.
              </li>
              <li>
                <Badge>3</Badge> Save them as one file per day, or all days in a single document.
              </li>
            </ol>
            <p className="mt-3 text-xs text-stone-500">
              Days you have made before are remembered, so making them again is instant.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
