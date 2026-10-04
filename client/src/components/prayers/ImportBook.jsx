import { useEffect, useRef, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import api from '../../api';
import { Alert, Button, Field, Input, LinkButton, Select, Spinner, cx } from '../ui.jsx';

/**
 * Import a parish's own prayer book: upload, review, save.
 *
 * A new parish's library holds placeholders and nothing else, and typing a
 * General Intercessions book in by hand is an afternoon per season. This takes
 * the book instead - a PDF, or a photograph of a page - reads the words out of
 * it, and shows what it understood.
 *
 * NOTHING IS SAVED UNTIL IT IS TICKED
 * -----------------------------------
 * The upload returns drafts. They are held in this component's state and go
 * nowhere near the library until somebody presses Save, and only the ticked
 * ones go then. That is not caution for its own sake: character recognition
 * misreads words, and these are prayers that get read aloud at Mass. A silent
 * import would turn a convenience into a liturgical accuracy problem.
 *
 * WHY EVERY DRAFT STARTS UNTICKED AND NEEDS A DAY
 * ----------------------------------------------
 * The parser reads a title off the page and nothing else. It does not guess the
 * season, the week or the weekday, because a page number is not liturgical data
 * and inventing that mapping is the one thing this application exists not to
 * do. So the cascade cannot match a draft until the office says where it
 * belongs, and the Save button says so rather than writing rows that can never
 * be found.
 *
 * NOT TESTED YET
 * --------------
 * This whole path - upload, extract, review, commit - has not been run against
 * a real book. It was written to be reviewed, and it should be walked through
 * with one PDF and one photograph before anybody relies on it.
 */

const WEEKDAYS = [
  { value: '', label: 'Any day' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export default function ImportBook({ onSaved, onSkip, compact = false }) {
  const [drafts, setDrafts] = useState([]);
  const [how, setHow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [progress, setProgress] = useState(null);
  const fileInput = useRef(null);

  // The season list is the same one the Template Manager offers, so an imported
  // prayer and a typed one cannot disagree about what a season is called.
  useEffect(() => {
    api
      .potfMeta()
      .then((meta) => setSeasons(meta.seasons || []))
      .catch(() => setSeasons([]));
  }, []);

  /**
   * Upload one or more files, and keep whatever comes back.
   *
   * One request per file, because the route takes a file as its own body - so a
   * book photographed page by page is twenty pictures, and they are sent in
   * sequence rather than at once. Sequence matters: optical character
   * recognition is not cheap, and twenty parallel requests would make the
   * server fight itself for the same CPU.
   *
   * Drafts ACCUMULATE. Picking more files adds to the list rather than
   * replacing it, which is what somebody going through a book a section at a
   * time needs; one file failing does not lose the pages already read, and the
   * failures are reported together at the end.
   */
  async function upload(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: files.length, name: files[0].name });

    let added = 0;
    const failures = [];
    let lastHow = how;

    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length, name: file.name });
      try {
        const payload = await api.importExtract(file);
        lastHow = payload.how;
        setDrafts((current) => [
          ...current,
          ...payload.drafts.map((draft, position) => ({
            ...draft,
            key: `${file.name}-${draft.page}-${position}-${current.length}`,
            source: file.name,
            include: false,
          })),
        ]);
        added += payload.drafts.length;
      } catch (error) {
        failures.push(`${file.name}: ${error.message}`);
      }
    }

    setHow(lastHow);
    setProgress(null);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';

    if (added && !failures.length) {
      setNotice({
        tone: 'info',
        text: `Read ${added} prayer${added === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}. Nothing is saved yet — check each one and say which day it belongs to.`,
      });
    } else if (added) {
      setNotice({
        tone: 'warn',
        text: `Read ${added} prayer${added === 1 ? '' : 's'}, but ${failures.length} file${failures.length === 1 ? '' : 's'} could not be read. ${failures.join(' ')}`,
      });
    } else {
      setNotice({ tone: 'error', text: failures.join(' ') || 'Nothing could be read out of those files.' });
    }
  }

  function edit(key, patch) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, prayer: { ...draft.prayer, ...patch } } : draft,
      ),
    );
  }

  const ready = drafts.filter((draft) => draft.include && draft.prayer);
  const missingDay = ready.filter((draft) => !draft.prayer.season && !draft.prayer.fixedDate);

  async function save() {
    if (!ready.length) return;
    if (missingDay.length) {
      setNotice({
        tone: 'error',
        text: `${missingDay.length} ticked prayer${missingDay.length === 1 ? '' : 's'} still needs a season or a date, or it will never match a day.`,
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const result = await api.importCommit(
        ready.map((draft) => ({
          ...draft.prayer,
          week: draft.prayer.week === '' || draft.prayer.week == null ? null : Number(draft.prayer.week),
          dayOfWeek:
            draft.prayer.dayOfWeek === '' || draft.prayer.dayOfWeek == null
              ? null
              : Number(draft.prayer.dayOfWeek),
        })),
      );
      setDrafts((current) => current.filter((draft) => !draft.include));
      setNotice({
        tone: result.failed.length ? 'warn' : 'success',
        text: result.failed.length
          ? `Saved ${result.saved.length}. ${result.failed.length} could not be saved: ${result.failed.map((entry) => entry.error).join('; ')}`
          : `Saved ${result.saved.length} prayer${result.saved.length === 1 ? '' : 's'} to your library.`,
      });
      onSaved?.(result.saved.length);
    } catch (error) {
      setNotice({ tone: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cx('flex flex-col gap-5', compact && 'gap-4')}>
      <div>
        <h2 className="font-serif text-[28px] leading-tight font-bold text-navy">
          Bring in your prayer book
        </h2>
        <p className="mt-2 text-muted">
          Upload a PDF of your General Intercessions book, or a photograph of one page.
          LiturgyGen reads the words out and shows you what it understood. Nothing reaches
          your library until you say so.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-edge bg-page-hi p-6 text-center">
        <input
          ref={fileInput}
          id="book-file"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          multiple
          disabled={busy}
          onChange={(event) => upload(event.target.files)}
        />
        <FileUp className="mx-auto size-7 text-tile-edge" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted">
          PDFs, or photographs of the pages. Pick as many as you like — they are read one after another.
        </p>
        <Button
          icon={Upload}
          variant="secondary"
          className="mt-3"
          loading={busy}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? 'Reading…' : drafts.length ? 'Add more files' : 'Choose files'}
        </Button>
      </div>

      {busy && progress && (
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <Spinner />
          Reading {progress.name} — file {progress.done + 1} of {progress.total}. A photographed
          page takes a few seconds.
        </p>
      )}

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {how === 'ocr' && drafts.length > 0 && (
        <Alert tone="warn" title="This was read by character recognition">
          Words get misread, especially names and numbers. Read each prayer before you tick it.
        </Alert>
      )}

      {drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <article
              key={draft.key}
              className={cx(
                'rounded-lg bg-page p-4 ring-1 ring-edge',
                draft.include && 'ring-2 ring-navy',
              )}
            >
              <header className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 shrink-0 cursor-pointer accent-navy"
                  checked={draft.include}
                  disabled={!draft.prayer}
                  aria-label={`Save page ${draft.page}`}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((entry) =>
                        entry.key === draft.key
                          ? { ...entry, include: event.target.checked }
                          : entry,
                      ),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  {draft.prayer ? (
                    <Field label="Title" htmlFor={`title-${draft.key}`}>
                      <Input
                        id={`title-${draft.key}`}
                        value={draft.prayer.title}
                        onChange={(event) => edit(draft.key, { title: event.target.value })}
                      />
                    </Field>
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink">
                      Page {draft.page} of {draft.source} could not be read
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted">
                    Page {draft.page}{draft.source ? ` of ${draft.source}` : ' of the upload'}
                  </p>
                </div>
              </header>

              {draft.prayer && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Season" htmlFor={`season-${draft.key}`}>
                    <Select
                      id={`season-${draft.key}`}
                      value={draft.prayer.season || ''}
                      onChange={(event) => edit(draft.key, { season: event.target.value || null })}
                    >
                      <option value="">Choose a season…</option>
                      {seasons.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Week" htmlFor={`week-${draft.key}`} hint="Leave empty for any week.">
                    <Input
                      id={`week-${draft.key}`}
                      type="number"
                      min="1"
                      max="34"
                      value={draft.prayer.week ?? ''}
                      onChange={(event) => edit(draft.key, { week: event.target.value })}
                    />
                  </Field>
                  <Field label="Weekday" htmlFor={`day-${draft.key}`}>
                    <Select
                      id={`day-${draft.key}`}
                      value={draft.prayer.dayOfWeek ?? ''}
                      onChange={(event) => edit(draft.key, { dayOfWeek: event.target.value })}
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              {draft.problems.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-muted">
                  {draft.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-navy">
                  {draft.prayer
                    ? `${draft.prayer.intentions.length} intentions — show what was read`
                    : 'Show what was read'}
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-page-hi p-3 text-sm whitespace-pre-wrap text-ink ring-1 ring-edge">
                  {draft.text}
                </pre>
              </details>
            </article>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={save}
          loading={saving}
          disabled={saving || !ready.length}
        >
          {ready.length ? `Save ${ready.length} to my library` : 'Save to my library'}
        </Button>
        {onSkip && <LinkButton onClick={onSkip}>Skip for now</LinkButton>}
      </div>
    </div>
  );
}
