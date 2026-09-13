import { Check, Download } from 'lucide-react';
import { formatLong } from '../../lib/dates';
import { stripeClass } from '../../lib/tiles';
import { Alert, Button, LinkButton, Note, cx } from '../ui';

function Step({ number, state, title, children }) {
  return (
    <li className="grid grid-cols-[1.9rem_1fr] gap-3">
      <span
        aria-hidden="true"
        className={cx(
          'grid size-[1.9rem] place-items-center rounded-full border-[1.5px] text-[15px] font-bold',
          state === 'done' && 'border-navy bg-navy text-page',
          state === 'now' && 'border-gold bg-gold text-ink',
          state === 'next' && 'border-navy text-navy',
        )}
      >
        {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : number}
      </span>
      <div className="pt-0.5">
        <p className="text-base">
          <span className="sr-only">{state === 'done' ? 'Done: ' : state === 'now' ? 'Now: ' : 'Next: '}</span>
          {title}
        </p>
        {children}
      </div>
    </li>
  );
}

/** The left page of a day's book: what the day is, the three steps, notes, download. */
export default function DayPage({ iso, day, loading, error, blocked, notice, onDismissNotice, busy, onEdit, onPrayers, onRefresh, onPaste, onDownload }) {
  const liturgy = day && day.liturgy;
  const fromElsewhere = day && day.potf && day.potfTitle && day.potfTitle !== day.occasionTitle;
  const readingsMissing = Boolean(day && day.readingsError);

  return (
    <div className="flex h-full flex-col">
      <p className="text-sm font-medium text-muted">{formatLong(iso)}</p>
      <h2 className="mt-1 font-serif text-[28px] font-bold text-ink">
        {liturgy
          ? liturgy.celebration.name.charAt(0).toUpperCase() + liturgy.celebration.name.slice(1)
          : loading
            ? 'Opening…'
            : formatLong(iso)}
      </h2>
      {liturgy && (
        <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className={cx('inline-block size-2.5 rounded-full ring-1 ring-black/10', stripeClass(liturgy))} />
          {[liturgy.celebration.color.name, liturgy.celebration.rankLabel, liturgy.season.name && liturgy.season.week ? `week ${liturgy.season.week} of ${liturgy.season.name}` : liturgy.season.name]
            .filter(Boolean)
            .join(', ')}
        </p>
      )}

      <ol className="mt-6 space-y-4">
        <Step number={1} state="done" title="Day chosen" />
        <Step number={2} state={day ? 'now' : 'next'} title="Check the readings and prayers">
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <LinkButton onClick={onEdit} disabled={!day}>
              Edit this page
            </LinkButton>
            <LinkButton onClick={onPrayers} disabled={!day}>
              Use other prayers
            </LinkButton>
            <LinkButton onClick={onRefresh} disabled={busy || loading}>
              Get readings again
            </LinkButton>
            {(blocked || readingsMissing) && <LinkButton onClick={onPaste}>Paste from USCCB</LinkButton>}
          </div>
        </Step>
        <Step number={3} state="next" title="Download the Word file" />
      </ol>

      <div className="mt-6 space-y-2.5">
        {error && (
          <Alert tone="error" title="This day could not be opened">
            <p>{error}</p>
            {blocked && (
              <p className="mt-1">The readings website blocked the request. Use Paste from USCCB to add them by hand.</p>
            )}
          </Alert>
        )}
        {fromElsewhere && (
          <Note>
            The prayers come from {day.potfMatch.includes('Ordinary Time') || day.potfTitle.includes('ORDINARY TIME') ? 'the Ordinary Time book' : 'another day'} ({day.potfTitle}), so that heading is printed above them.
          </Note>
        )}
        {day &&
          day.warnings.map((warning) => (
            <Note key={warning}>
              {warning}
              {!day.potf && warning.includes('Prayers of the Faithful') && (
                <div className="mt-2">
                  <Button size="sm" onClick={onPrayers}>
                    Use other prayers
                  </Button>
                </div>
              )}
            </Note>
          ))}
        {notice && (
          <Alert tone={notice.tone} onDismiss={onDismissNotice}>
            {notice.text}
          </Alert>
        )}
      </div>

      <div className="mt-auto pt-8">
        <Button variant="primary" size="lg" pill icon={Download} onClick={onDownload} loading={busy === 'download'} disabled={!day || readingsMissing}>
          Download Word file
        </Button>
        {day && <p className="mt-2 text-sm text-muted">Saved as {day.fileName}</p>}
      </div>
    </div>
  );
}
