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
  const fileInput = useRef(null);

  // The season list is the same one the Template Manager offers, so an imported
  // prayer and a typed one cannot disagree about what a season is called.
  useEffect(() => {
    api
      .potfMeta()
      .then((meta) => setSeasons(meta.seasons || []))
      .catch(() => setSeasons([]));
  }, []);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const payload = await api.importExtract(file);
      setHow(payload.how);
      setDrafts(
        payload.drafts.map((draft, index) => ({
          ...draft,
          key: `${draft.page}-${index}`,
          // Unticked on purpose: see the note at the top.
          include: false,
        })),
      );
      const readable = payload.drafts.filter((draft) => draft.prayer).length;
      setNotice({
        tone: readable ? 'info' : 'warn',
        text: readable
          ? `Read ${readable} prayer${readable === 1 ? '' : 's'} out of ${file.name}. Nothing is saved yet — check each one and say which day it belongs to.`
          : `Nothing in ${file.name} could be read as a prayer. The pages are below if you want to see what came out.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
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
          accept="application/pdf,image/png,image/jpeg"
          className="sr-only"
          disabled={busy}
          onChange={(event) => upload(event.target.files?.[0])}
        />
        <FileUp className="mx-auto size-7 text-tile-edge" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted">A PDF, or a JPEG or PNG of one page.</p>
        <Button
          icon={Upload}
          variant="secondary"
          className="mt-3"
          loading={busy}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? 'Reading the file…' : 'Choose a file'}
        </Button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> A scanned book takes a while — recognition runs a page at a time.
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
                      Page {draft.page} could not be read
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted">Page {draft.page} of the upload</p>
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
