import { useState } from 'react';
import { Archive, CheckCircle2, CircleDashed, CloudDownload, FileStack, Play, TriangleAlert, X, XCircle } from 'lucide-react';
import api from '../../api';
import { formatLong, parseIso, WEEKDAY_SHORT, MONTH_NAMES } from '../../lib/dates';
import { datesToFetch, needsLook, sortByNeed } from '../../lib/issues';
import { countLabel } from '../../lib/selection';
import { tileLabel } from '../../lib/tiles';
import { Alert, Button, LinkButton, Textarea, cx } from '../ui';

const rowDate = (iso) => {
  const { day, month, weekday } = parseIso(iso);
  const name = MONTH_NAMES[month - 1];
  return `${WEEKDAY_SHORT[weekday]} ${day} ${name === 'September' ? 'Sept' : name.slice(0, 3)}`;
};

const STATUS_ICON = {
  issues: { Icon: TriangleAlert, cls: 'text-rubric', label: 'Needs a look' },
  failed: { Icon: XCircle, cls: 'text-bad', label: 'Readings could not be fetched' },
  ok: { Icon: CheckCircle2, cls: 'text-ok', label: 'Ready' },
  unfetched: { Icon: CircleDashed, cls: 'text-muted', label: 'Readings not fetched yet' },
};

/**
 * The right-hand panel while several days are chosen: the list, this batch's
 * intentions, saving the schedule, making the files, progress and results.
 */
export default function MakingPanel({ selection, daysByDate, onRemove, onOpenDay, intentions, onIntentionsChange, batch, fetchJob, statusOf }) {
  const [editingIntentions, setEditingIntentions] = useState(false);
  const [notice, setNotice] = useState(null);
  const { job, starting, error, running, finished, percent } = batch;
  const busy = running || fetchJob.running;
  const intentionCount = intentions.split('\n').filter((line) => line.trim()).length;

  const act = (fn, success) => async () => {
    setNotice(null);
    try {
      const result = await fn();
      if (success) setNotice({ tone: 'success', text: success(result) });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    }
  };

  const needsWork = selection.filter((iso) => needsLook(statusOf(iso)));
  const toFetch = datesToFetch(selection, statusOf);
  const unfetched = selection.filter((iso) => statusOf(iso).unfetched).length;

  return (
    <aside
      aria-label="Days chosen"
      className="animate-panel flex min-h-0 w-full flex-col gap-3 border-edge bg-page p-5 max-[1023px]:border-t min-[1024px]:w-[29%] min-[1024px]:min-w-[20rem] min-[1024px]:border-l"
    >
      <h2 className="figures-lining font-serif text-[22px] font-bold">{countLabel(selection.length)}</h2>

      {selection.length === 0 && !job && (
        <p className="text-sm text-muted">Click days in the month, or use the buttons above it, to choose which days to make.</p>
      )}

      {needsWork.length > 0 && (
        <Alert tone="warn" title={`${needsWork.length} ${needsWork.length === 1 ? 'day needs' : 'days need'} a look`}>
          {finished
            ? 'Open a day to fix its readings or choose its prayers, then make it again.'
            : 'They are listed first. Open a day to fix its readings or choose its prayers before making the files.'}
        </Alert>
      )}

      {fetchJob.running ? (
        <div className="space-y-1.5 text-sm" aria-live="polite">
          <div className="flex justify-between gap-2 text-muted">
            <span>
              Getting readings for day {Math.min(fetchJob.job.completed + fetchJob.job.failed + 1, fetchJob.job.total)} of {fetchJob.job.total}…
            </span>
            <LinkButton onClick={fetchJob.cancel}>Stop</LinkButton>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[2px] bg-edge" role="progressbar" aria-valuenow={fetchJob.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-gold transition-all" style={{ width: `${fetchJob.percent}%` }} />
          </div>
          {fetchJob.job.message && /Waiting/.test(fetchJob.job.message) && <p className="text-muted">{fetchJob.job.message}</p>}
        </div>
      ) : (
        toFetch.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-l-[3px] border-navy bg-page-hi py-2.5 pr-3 pl-3.5 text-sm">
            <span className="text-muted">
              {[
                unfetched > 0 &&
                  `${unfetched} ${unfetched === 1 ? 'day has' : 'days have'} no readings fetched yet, so ${unfetched === 1 ? 'it' : 'they'} cannot be fully checked.`,
                toFetch.length > unfetched &&
                  `${toFetch.length - unfetched} ${toFetch.length - unfetched === 1 ? 'day is' : 'days are'} missing lines that fetching again may fill.`,
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
            <Button
              size="sm"
              icon={CloudDownload}
              loading={fetchJob.starting}
              disabled={busy}
              onClick={() => fetchJob.start({ dates: toFetch, checkOnly: true })}
            >
              Get readings for {toFetch.length}
            </Button>
          </div>
        )
      )}
      {fetchJob.error && <Alert tone="error">{fetchJob.error}</Alert>}

      <ul className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {sortByNeed(selection, statusOf).map((iso) => {
            const status = statusOf(iso);
            const icon = STATUS_ICON[status.state];
            return (
              <li key={iso} className="border-b border-edge py-2">
                <div className="flex items-center gap-2">
                  {icon ? (
                    <icon.Icon role="img" aria-label={icon.label} className={cx('size-4 shrink-0', icon.cls)}>
                      <title>{icon.label}</title>
                    </icon.Icon>
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDay(iso)}
                    className="min-w-0 flex-1 cursor-pointer text-left hover:underline"
                    title={`Open ${formatLong(iso)}`}
                  >
                    <span className="figures-lining block font-semibold">{rowDate(iso)}</span>
                    <span className="block truncate font-serif text-[14px] text-muted">{tileLabel(daysByDate[iso]) || formatLong(iso)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(iso)}
                    disabled={busy}
                    aria-label={`Remove ${formatLong(iso)}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[5px] text-muted hover:bg-page-hi hover:text-ink disabled:opacity-40"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {needsLook(status) && (
                  <ul className={cx('mt-1 space-y-0.5 pl-6 text-sm', status.state === 'failed' ? 'text-bad' : 'text-note-ink')}>
                    {status.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                    {status.unfetched && status.state === 'issues' && <li className="text-muted">Readings not fetched yet.</li>}
                  </ul>
                )}
              </li>
            );
          })}
        {running && job.currentDate && !selection.includes(job.currentDate) && (
          <li className="py-2 text-sm text-muted">Making {formatLong(job.currentDate)}…</li>
        )}
      </ul>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">
            School-wide intentions: {intentionCount || 'none'}
          </span>
          <LinkButton onClick={() => setEditingIntentions((open) => !open)}>
            {editingIntentions ? 'Done' : 'Change'}
          </LinkButton>
        </div>
        {editingIntentions && (
          <Textarea
            rows={3}
            value={intentions}
            onChange={(event) => onIntentionsChange(event.target.value)}
            placeholder={'For the intentions of our benefactors\nFor the success of our patronal feast'}
            aria-label="School-wide intentions, one per line"
          />
        )}
        <LinkButton
          disabled={!selection.length}
          onClick={act(() => api.addSchedule({ dates: selection }), () => 'Saved as your Mass schedule.')}
        >
          Save these dates as our Mass schedule
        </LinkButton>
      </div>

      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {job && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-muted">
            <span>
              {running
                ? `Making day ${Math.min(job.completed + job.failed + 1, job.total)} of ${job.total}…`
                : job.status === 'cancelled'
                  ? 'Stopped.'
                  : `${job.completed} made, ${job.failed} could not be made.`}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[2px] bg-edge" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={cx('h-full bg-navy transition-all', job.status === 'failed' && 'bg-bad')} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {finished && job.completed > 0 && (
        <div className="grid gap-2">
          <Button variant="primary" icon={Archive} onClick={act(batch.downloadZip, (name) => `Downloaded ${name}`)}>
            Download all as ZIP
          </Button>
          <Button icon={FileStack} onClick={act(batch.downloadCombined, (name) => `Downloaded ${name}`)}>
            Download one master file
          </Button>
        </div>
      )}

      {running ? (
        <Button variant="danger" size="lg" icon={XCircle} onClick={batch.cancel}>
          Cancel
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          icon={Play}
          loading={starting}
          disabled={!selection.length || fetchJob.running}
          onClick={() =>
            batch.start({
              dates: selection,
              extraIntentions: intentions.split('\n').map((line) => line.trim()).filter(Boolean),
            })
          }
        >
          {finished ? `Make ${selection.length} again` : `Make ${selection.length || ''} Word ${selection.length === 1 ? 'file' : 'files'}`}
        </Button>
      )}
    </aside>
  );
}
