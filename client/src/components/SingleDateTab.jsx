import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardPaste,
  Download,
  FileText,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import api from '../api';
import { formatLong, parseIso, todayIso } from '../lib/dates';
import LiturgicalCalendar from './LiturgicalCalendar';
import DocumentPreview from './DocumentPreview';
import {
  Alert,
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  toneForColor,
} from './ui';

const linesToText = (lines) => (lines || []).join('\n');
const textToLines = (text) => text.split('\n').map((line) => line.trimEnd());

export default function SingleDateTab({ settings, templates }) {
  const initial = todayIso();
  const [date, setDate] = useState(initial);
  const [cursor, setCursor] = useState(() => {
    const { year, month } = parseIso(initial);
    return { year, month };
  });

  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const [templateId, setTemplateId] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importHtml, setImportHtml] = useState('');

  const load = useCallback(
    async (targetDate, { force = false, keepTemplate = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.preview({
          date: targetDate,
          force,
          potfTemplateId: keepTemplate && templateId ? Number(templateId) : null,
        });
        setDay(payload);
        setEditing(false);
        setDraft(null);
      } catch (err) {
        setError(err);
        setDay(null);
      } finally {
        setLoading(false);
      }
    },
    [templateId],
  );

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const selectDate = (iso) => {
    setTemplateId('');
    setNotice(null);
    setDate(iso);
    // Keep the month grid on the chosen date, including when it is typed in.
    const { year, month } = parseIso(iso);
    setCursor((current) => (current.year === year && current.month === month ? current : { year, month }));
  };

  const chooseTemplate = async (value) => {
    setTemplateId(value);
    setLoading(true);
    try {
      const payload = await api.preview({
        date,
        potfTemplateId: value ? Number(value) : null,
      });
      setDay(payload);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------- *
   * Editing
   * ---------------------------------------------------------------- */

  const startEditing = () => {
    const readings = (day && day.readings) || {};
    setDraft({
      reading1Intro: (readings.reading1 && readings.reading1.intro) || '',
      reading1Citation: (readings.reading1 && readings.reading1.citation) || '',
      reading1Text: linesToText(readings.reading1 && readings.reading1.lines),
      psalmCitation: (readings.psalm && readings.psalm.citation) || '',
      psalmRefrain: (readings.psalm && readings.psalm.refrain) || '',
      psalmStanzas: ((readings.psalm && readings.psalm.stanzas) || [])
        .map((stanza) => stanza.join('\n'))
        .join('\n\n'),
      acclamationRefrain: (readings.acclamation && readings.acclamation.refrain) || 'Alleluia, alleluia.',
      acclamationVerse: linesToText(readings.acclamation && readings.acclamation.verse),
      occasionTitle: day.occasionTitle || '',
      priestInvitation: (day.potf && day.potf.priestInvitation) || '',
      responseOptions: ((day.potf && day.potf.responseOptions) || []).join('\n'),
      intentions: ((day.potf && day.potf.intentions) || []).join('\n'),
      priestConclusion: (day.potf && day.potf.priestConclusion) || '',
    });
    setEditing(true);
  };

  const draftPayload = useMemo(() => {
    if (!draft || !day) return null;
    const readings = day.readings || {};
    return {
      readingsOverride: {
        ...readings,
        reading1: readings.reading1
          ? {
              ...readings.reading1,
              intro: draft.reading1Intro || null,
              citation: draft.reading1Citation || null,
              lines: textToLines(draft.reading1Text),
            }
          : readings.reading1,
        psalm: readings.psalm
          ? {
              ...readings.psalm,
              citation: draft.psalmCitation || null,
              refrain: draft.psalmRefrain || null,
              stanzas: draft.psalmStanzas
                .split(/\n\s*\n/)
                .map((stanza) => stanza.split('\n').filter(Boolean))
                .filter((stanza) => stanza.length),
            }
          : readings.psalm,
        acclamation: {
          ...(readings.acclamation || { heading: 'Gospel Acclamation', citation: null }),
          refrain: draft.acclamationRefrain || 'Alleluia, alleluia.',
          verse: textToLines(draft.acclamationVerse).filter(Boolean),
        },
      },
      occasionTitle: draft.occasionTitle,
      potfOverride: {
        priestInvitation: draft.priestInvitation,
        responseOptions: draft.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean),
        intentions: draft.intentions.split('\n').map((s) => s.trim()).filter(Boolean),
        priestConclusion: draft.priestConclusion,
      },
    };
  }, [draft, day]);

  /** The preview reflects unsaved edits, so what you see is what downloads. */
  const previewDay = useMemo(() => {
    if (!day) return null;
    if (!editing || !draftPayload) return day;
    return {
      ...day,
      occasionTitle: draftPayload.occasionTitle,
      readings: draftPayload.readingsOverride,
      potf: draftPayload.potfOverride,
    };
  }, [day, editing, draftPayload]);

  const saveCorrections = async () => {
    if (!draftPayload) return;
    setBusy('save');
    setNotice(null);
    try {
      await api.saveReadings(date, draftPayload.readingsOverride);
      setNotice({
        tone: 'success',
        text: `Corrections for ${formatLong(date)} saved. They will be reused every time this date is generated.`,
      });
      await load(date, { keepTemplate: true });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const revertCorrections = async () => {
    setBusy('revert');
    try {
      await api.clearOverride(date);
      setNotice({ tone: 'info', text: 'Saved corrections removed; the source text is back.' });
      await load(date, { force: true, keepTemplate: true });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    setNotice(null);
    try {
      await api.importReadings(date, importHtml);
      setImportOpen(false);
      setImportHtml('');
      setNotice({ tone: 'success', text: 'Readings imported from the pasted page.' });
      await load(date, { keepTemplate: true });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const doDownload = async () => {
    setBusy('download');
    setNotice(null);
    try {
      const fileName = await api.generate({
        date,
        potfTemplateId: templateId ? Number(templateId) : null,
        ...(editing && draftPayload ? draftPayload : {}),
      });
      setNotice({ tone: 'success', text: `Downloaded ${fileName}` });
    } catch (err) {
      setNotice({ tone: 'error', text: err.hint ? `${err.message} ${err.hint}` : err.message });
    } finally {
      setBusy(null);
    }
  };

  const liturgy = day && day.liturgy;
  const isBlocked = error && (error.code === 'USCCB_CHALLENGE' || error.code === 'NO_PROVIDER');
  const readingsMissing = day && day.readingsError;

  return (
    <div className="grid gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
      {/* ---------------- left column ---------------- */}
      <div className="space-y-4">
        <Card title="Choose a date">
          <LiturgicalCalendar
            year={cursor.year}
            month={cursor.month}
            onNavigate={(year, month) => setCursor({ year, month })}
            selected={[date]}
            onSelect={selectDate}
          />
          <div className="mt-3 border-t border-stone-200 pt-3">
            <Field label="Or type a date">
              <Input type="date" value={date} onChange={(event) => event.target.value && selectDate(event.target.value)} />
            </Field>
          </div>
        </Card>

        {liturgy && (
          <Card>
            <p className="text-xs tracking-wide text-stone-500 uppercase">{formatLong(date)}</p>
            <p className="mt-1 font-serif text-lg leading-snug font-semibold text-stone-900">
              {liturgy.celebration.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={toneForColor(liturgy.celebration.color.key)}>
                {liturgy.celebration.color.name}
              </Badge>
              <Badge>{liturgy.celebration.rankLabel}</Badge>
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={Download}
              className="mt-4 w-full"
              onClick={doDownload}
              loading={busy === 'download'}
              disabled={!day || Boolean(readingsMissing)}
            >
              Download Word file
            </Button>
            {day && (
              <p className="mt-2 text-center text-xs text-stone-500">{day.fileName}</p>
            )}
          </Card>
        )}

        <Disclosure label="More options" hint={day ? day.potfMatch : undefined}>
          <div className="space-y-4">
            <Field
              label="Which prayers to print"
              hint={day ? `Now using: ${day.potfMatch}` : undefined}
            >
              <Select value={templateId} onChange={(event) => chooseTemplate(event.target.value)}>
                <option value="">Choose for me</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.isPlaceholder ? `${template.title} (placeholder)` : template.title}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Button
                icon={RefreshCw}
                onClick={() => load(date, { force: true, keepTemplate: true })}
                loading={loading}
              >
                Get readings again
              </Button>
              <Button icon={ClipboardPaste} onClick={() => setImportOpen((open) => !open)}>
                Paste from USCCB
              </Button>
            </div>

            {liturgy && (
              <dl className="space-y-1 border-t border-stone-200 pt-3 text-xs text-stone-600">
                <div className="flex justify-between gap-2">
                  <dt>Heading printed</dt>
                  <dd className="text-right font-medium text-stone-800">{day.occasionTitle}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Readings came from</dt>
                  <dd className="text-right font-medium text-stone-800">
                    {day.readings ? day.readings.source : '—'}
                  </dd>
                </div>
                {liturgy.season.name && (
                  <div className="flex justify-between gap-2">
                    <dt>Season</dt>
                    <dd className="text-right font-medium text-stone-800">
                      {liturgy.season.name}
                      {liturgy.season.week ? ` · week ${liturgy.season.week}` : ''}
                    </dd>
                  </div>
                )}
                {liturgy.cycles.sunday && (
                  <div className="flex justify-between gap-2">
                    <dt>Cycle</dt>
                    <dd className="text-right font-medium text-stone-800">
                      {liturgy.cycles.sunday.replace('YEAR_', 'Cycle ')} ·{' '}
                      {liturgy.cycles.weekday === 'YEAR_1' ? 'Year I' : 'Year II'}
                    </dd>
                  </div>
                )}
                {liturgy.optionalMemorials.length > 0 && (
                  <p className="pt-2 text-stone-500">
                    Optional today: {liturgy.optionalMemorials.map((m) => m.name).join('; ')}
                  </p>
                )}
              </dl>
            )}
          </div>
        </Disclosure>
      </div>

      {/* ---------------- right column ---------------- */}
      <div className="space-y-4">
        {notice && (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}

        {error && (
          <Alert tone="error" title="Could not build this day">
            <p>{error.message}</p>
            {isBlocked && (
              <p className="mt-2">
                Open{' '}
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://bible.usccb.org/bible/readings/${date.slice(5, 7)}${date.slice(8, 10)}${date.slice(2, 4)}.cfm`}
                >
                  the USCCB page for this date
                </a>{' '}
                in your browser, view the page source, copy all of it, then use{' '}
                <strong>Import</strong> to paste it here.
              </p>
            )}
          </Alert>
        )}

        {importOpen && (
          <Card
            title="Import readings"
            subtitle="Paste the full HTML source of the USCCB readings page for this date."
            actions={
              <Button size="sm" variant="ghost" icon={X} onClick={() => setImportOpen(false)}>
                Close
              </Button>
            }
          >
            <Textarea
              rows={6}
              value={importHtml}
              onChange={(event) => setImportHtml(event.target.value)}
              placeholder="<!doctype html> …"
              className="font-mono text-xs"
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="primary"
                icon={ClipboardPaste}
                onClick={doImport}
                loading={busy === 'import'}
                disabled={importHtml.trim().length < 200}
              >
                Parse and use
              </Button>
            </div>
          </Card>
        )}

        {day && day.warnings.length > 0 && (
          <Alert tone="warn" title="Check before printing">
            <ul className="list-inside list-disc space-y-0.5">
              {day.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Card
          title="Preview"
          subtitle="Exactly what the Word file will say."
          actions={
            <>
              {editing ? (
                <>
                  <Button size="sm" icon={Save} onClick={saveCorrections} loading={busy === 'save'}>
                    Save corrections
                  </Button>
                  <Button size="sm" variant="ghost" icon={X} onClick={() => setEditing(false)}>
                    Done
                  </Button>
                </>
              ) : (
                <Button size="sm" icon={Pencil} onClick={startEditing} disabled={!day}>
                  Edit
                </Button>
              )}
            </>
          }
          bodyClassName="bg-stone-100 p-4"
        >
          {loading && !day ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : previewDay ? (
            <DocumentPreview day={previewDay} settings={settings} />
          ) : (
            <EmptyState icon={FileText} title="Nothing to preview yet">
              Pick a date to build its missalette page.
            </EmptyState>
          )}
        </Card>

        {editing && draft && (
          <Card title="Edit this day" subtitle="Changes appear in the preview immediately.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Heading above the intercessions" className="md:col-span-2">
                <Input
                  value={draft.occasionTitle}
                  onChange={(event) => setDraft({ ...draft, occasionTitle: event.target.value })}
                />
              </Field>

              <Field label="First reading citation">
                <Input
                  value={draft.reading1Citation}
                  onChange={(event) => setDraft({ ...draft, reading1Citation: event.target.value })}
                />
              </Field>
              <Field label="First reading introduction">
                <Input
                  value={draft.reading1Intro}
                  onChange={(event) => setDraft({ ...draft, reading1Intro: event.target.value })}
                />
              </Field>
              <Field
                label="First reading text"
                hint="One lectionary line per row; leave a blank row for a stanza break."
                className="md:col-span-2"
              >
                <Textarea
                  rows={8}
                  value={draft.reading1Text}
                  onChange={(event) => setDraft({ ...draft, reading1Text: event.target.value })}
                />
              </Field>

              <Field label="Psalm citation">
                <Input
                  value={draft.psalmCitation}
                  onChange={(event) => setDraft({ ...draft, psalmCitation: event.target.value })}
                />
              </Field>
              <Field label="Psalm response (R.)">
                <Input
                  value={draft.psalmRefrain}
                  onChange={(event) => setDraft({ ...draft, psalmRefrain: event.target.value })}
                  placeholder="I shall live in the house of the Lord…"
                />
              </Field>
              <Field label="Psalm verses" hint="Blank line between stanzas." className="md:col-span-2">
                <Textarea
                  rows={8}
                  value={draft.psalmStanzas}
                  onChange={(event) => setDraft({ ...draft, psalmStanzas: event.target.value })}
                />
              </Field>

              <Field label="Acclamation response">
                <Input
                  value={draft.acclamationRefrain}
                  onChange={(event) => setDraft({ ...draft, acclamationRefrain: event.target.value })}
                />
              </Field>
              <Field label="Acclamation verse (Commentator)">
                <Textarea
                  rows={2}
                  value={draft.acclamationVerse}
                  onChange={(event) => setDraft({ ...draft, acclamationVerse: event.target.value })}
                />
              </Field>

              <Field label="Priest — invitation" className="md:col-span-2">
                <Textarea
                  rows={3}
                  value={draft.priestInvitation}
                  onChange={(event) => setDraft({ ...draft, priestInvitation: event.target.value })}
                />
              </Field>
              <Field label="Response options" hint="One per line; printed with OR between them.">
                <Textarea
                  rows={3}
                  value={draft.responseOptions}
                  onChange={(event) => setDraft({ ...draft, responseOptions: event.target.value })}
                />
              </Field>
              <Field label="Intentions" hint="One per line, without the numbering.">
                <Textarea
                  rows={6}
                  value={draft.intentions}
                  onChange={(event) => setDraft({ ...draft, intentions: event.target.value })}
                />
              </Field>
              <Field label="Priest — concluding prayer" className="md:col-span-2">
                <Textarea
                  rows={3}
                  value={draft.priestConclusion}
                  onChange={(event) => setDraft({ ...draft, priestConclusion: event.target.value })}
                />
              </Field>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
              <p className="text-xs text-stone-500">
                “Save corrections” stores the reading text for this date only. To change the
                intercessions everywhere, edit the template under Prayers of the Faithful.
              </p>
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                onClick={revertCorrections}
                loading={busy === 'revert'}
                className="shrink-0"
              >
                Undo saved corrections
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
