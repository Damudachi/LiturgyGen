import { useState } from 'react';
import { Archive, CheckCircle2, FileStack, Play, TriangleAlert, X, XCircle } from 'lucide-react';
import api from '../../api';
import { formatLong, parseIso, WEEKDAY_SHORT, MONTH_NAMES } from '../../lib/dates';
import { countLabel } from '../../lib/selection';
import { tileLabel } from '../../lib/tiles';
import { Alert, Button, LinkButton, Textarea, cx } from '../ui';

const rowDate = (iso) => {
  const { day, month, weekday } = parseIso(iso);
  const name = MONTH_NAMES[month - 1];
  return `${WEEKDAY_SHORT[weekday]} ${day} ${name === 'September' ? 'Sept' : name.slice(0, 3)}`;
};

/**
 * The right-hand panel while several days are chosen: the list, this batch's
 * intentions, saving the schedule, making the files, progress and results.
 */
export default function MakingPanel({ selection, daysByDate, onRemove, onOpenDay, intentions, onIntentionsChange, batch }) {
  const [editingIntentions, setEditingIntentions] = useState(false);
  const [notice, setNotice] = useState(null);
  const { job, starting, error, running, finished, percent } = batch;
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

  const resultsByDate = new Map((job ? job.results : []).map((result) => [result.date, result]));
  const needsWork = job ? job.results.filter((result) => !result.ok || result.warnings.length) : [];

  return (
    <aside
      aria-label="Days chosen"
      className="animate-panel flex min-h-0 w-full flex-col gap-3 border-edge bg-page p-5 max-[1023px]:border-t min-[1024px]:w-[29%] min-[1024px]:min-w-[20rem] min-[1024px]:border-l"
    >
      <h2 className="font-serif text-xl font-semibold">{countLabel(selection.length)}</h2>

      {selection.length === 0 && !job && (
        <p className="text-sm text-muted">Click days in the month, or use the buttons above it, to choose which days to make.</p>
      )}

      {needsWork.length > 0 && finished && (
        <Alert tone="warn" title={`${needsWork.length} ${needsWork.length === 1 ? 'day needs' : 'days need'} a look`}>
          Open a day to paste its readings or choose its prayers, then make it again.
        </Alert>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {[...selection]
          .sort((a, b) => {
            // Days needing work first once a run has finished.
            const rank = (iso) => (finished && needsWork.some((r) => r.date === iso) ? 0 : 1);
            return rank(a) - rank(b) || a.localeCompare(b);
          })
          .map((iso) => {
            const result = resultsByDate.get(iso);
            const Icon = result ? (result.ok ? (result.warnings.length ? TriangleAlert : CheckCircle2) : XCircle) : null;
            return (
              <li key={iso} className="border-b border-edge py-2">
                <div className="flex items-center gap-2">
                  {Icon && (
                    <Icon
                      aria-label={result.ok ? (result.warnings.length ? 'Needs a look' : 'Made') : 'Could not be made'}
                      className={cx('size-4 shrink-0', result.ok ? (result.warnings.length ? 'text-gold-edge' : 'text-ok') : 'text-bad')}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDay(iso)}
                    className="min-w-0 flex-1 cursor-pointer text-left hover:underline"
                    title={`Open ${formatLong(iso)}`}
                  >
                    <span className="font-medium">{rowDate(iso)}</span>
                    <span className="text-muted"> · {tileLabel(daysByDate[iso]) || formatLong(iso)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(iso)}
                    disabled={running}
                    aria-label={`Remove ${formatLong(iso)}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-tile hover:text-ink disabled:opacity-40"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {result && (!result.ok || result.warnings.length > 0) && (
                  <p className={cx('mt-1 pl-6 text-sm', result.ok ? 'text-note-ink' : 'text-bad')}>
                    {result.ok ? result.warnings.join(' ') : result.error}
                  </p>
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
          <div className="h-2 overflow-hidden rounded-full bg-edge" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={cx('h-full rounded-full bg-navy transition-all', job.status === 'failed' && 'bg-bad')} style={{ width: `${percent}%` }} />
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
          disabled={!selection.length}
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
