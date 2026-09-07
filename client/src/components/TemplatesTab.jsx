import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardPaste, Copy, Plus, Save, Search, Trash2, Wand2 } from 'lucide-react';
import api from '../api';
import { WEEKDAY_NAMES } from '../lib/dates';
import { Alert, Button, Card, Disclosure, EmptyState, Field, Input, Select, Textarea, cx } from './ui';

const BLANK = {
  title: '',
  season: 'Ordinary Time',
  week: '',
  dayOfWeek: '',
  celebrationId: '',
  priestInvitation: '',
  responseOptions: 'Lord, hear our prayer.',
  intentions: '',
  priestConclusion: '',
  notes: '',
};

const toForm = (template) => ({
  title: template.title || '',
  season: template.season,
  week: template.week == null ? '' : String(template.week),
  dayOfWeek: template.dayOfWeek || '',
  celebrationId: template.celebrationId || '',
  priestInvitation: template.priestInvitation || '',
  responseOptions: (template.responseOptions || []).join('\n'),
  intentions: (template.intentions || []).join('\n'),
  priestConclusion: template.priestConclusion || '',
  notes: template.notes || '',
});

const toPayload = (form) => ({
  title: form.title.trim(),
  season: form.season,
  week: form.week === '' ? null : Number(form.week),
  dayOfWeek: form.dayOfWeek || null,
  celebrationId: form.celebrationId.trim() || null,
  priestInvitation: form.priestInvitation.trim(),
  responseOptions: form.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean),
  intentions: form.intentions.split('\n').map((s) => s.trim()).filter(Boolean),
  priestConclusion: form.priestConclusion.trim(),
  notes: form.notes.trim() || null,
});

/**
 * Type a prayer in the shape it is printed - heading, invitation, the response in
 * capitals, the numbered intentions, then the concluding prayer - and the server
 * splits it into the fields the template needs. Nobody has to know the fields exist.
 */
function TypeInCard({ seasons, onSaved, onCancel }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [where, setWhere] = useState({ season: 'Ordinary Time', week: '', dayOfWeek: '', fixedDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.potfParse(text));
    } catch (err) {
      setPreview(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { template } = await api.potfImport({
        text,
        title: (preview && preview.title) || undefined,
        season: where.season,
        week: where.week === '' ? null : Number(where.week),
        dayOfWeek: where.dayOfWeek || null,
        fixedDate: where.fixedDate || null,
      });
      onSaved(template);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (event) => setWhere((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <Card
      title="Type in a prayer from the book"
      subtitle="Type it exactly as it is printed. LiturgyGen works out the parts."
      actions={
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="The page"
          hint="Heading, the invitation, the response in CAPITALS, the numbered intentions, then the closing prayer."
        >
          <Textarea
            rows={14}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              'SECOND OF FEBRUARY\n\n' +
              'The invitation the priest reads.\n\n' +
              'LORD, HEAR OUR PRAYER.\n\n' +
              'Or\n\n' +
              'FATHER, HEAR US.\n\n' +
              '1. That ... Let us pray to the Lord.\n' +
              '2. That ... Let us pray to the Lord.\n\n' +
              'The closing prayer the priest reads. Amen.'
            }
            className="font-mono text-xs"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Season">
            <Select value={where.season} onChange={set('season')}>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Week" hint="Leave blank for any week.">
            <Input type="number" min="1" max="34" value={where.week} onChange={set('week')} />
          </Field>
          <Field label="Day" hint="Leave blank for any day.">
            <Select value={where.dayOfWeek} onChange={set('dayOfWeek')}>
              <option value="">Any day</option>
              {WEEKDAY_NAMES.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Calendar date" hint="MM-DD, for days the book fixes to a date.">
            <Input placeholder="01-02" value={where.fixedDate} onChange={set('fixedDate')} />
          </Field>
        </div>

        {preview && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
            {preview.warnings.length > 0 && (
              <Alert tone="warning" className="mb-3">
                <ul className="list-disc pl-4">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
              {preview.title || 'Untitled'}
            </p>
            <p className="mt-2 text-stone-700">{preview.priestInvitation}</p>
            <p className="mt-2 font-semibold text-stone-900">{preview.responseOptions.join('  ·  ')}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-700">
              {preview.intentions.map((intention, index) => (
                <li key={index}>{intention}</li>
              ))}
            </ol>
            <p className="mt-2 text-stone-700">{preview.priestConclusion}</p>
            <p className="mt-3 text-xs text-stone-500">
              “Let us pray to the Lord.” and “Amen.” are added back when the document prints.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button icon={Wand2} onClick={check} disabled={busy || !text.trim()}>
            Check it
          </Button>
          <Button variant="primary" icon={Save} onClick={save} disabled={busy || !preview}>
            Add to the book
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function TemplatesTab({ templates, seasons, reload }) {
  const [search, setSearch] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (seasonFilter && template.season !== seasonFilter) return false;
      if (!needle) return true;
      return (
        template.title.toLowerCase().includes(needle) ||
        template.priestInvitation.toLowerCase().includes(needle) ||
        template.intentions.some((intention) => intention.toLowerCase().includes(needle))
      );
    });
  }, [templates, search, seasonFilter]);

  useEffect(() => {
    if (selectedId == null) return;
    const template = templates.find((item) => item.id === selectedId);
    if (template) setForm(toForm(template));
  }, [selectedId, templates]);

  const startNew = () => {
    setSelectedId('new');
    setForm({ ...BLANK });
    setNotice(null);
  };

  const startTypeIn = () => {
    setSelectedId('import');
    setForm(null);
    setNotice(null);
  };

  const select = (template) => {
    setSelectedId(template.id);
    setForm(toForm(template));
    setNotice(null);
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setNotice(null);
    try {
      const payload = toPayload(form);
      const saved =
        selectedId === 'new'
          ? await api.potfCreate(payload)
          : await api.potfUpdate(selectedId, payload);
      await reload();
      setSelectedId(saved.id);
      setNotice({ tone: 'success', text: `Saved “${saved.title}”.` });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (selectedId === 'new' || selectedId == null) return;
    setBusy(true);
    try {
      const copy = await api.potfDuplicate(selectedId);
      await reload();
      setSelectedId(copy.id);
      setNotice({ tone: 'success', text: 'Duplicated. Edit the copy and save.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selectedId === 'new' || selectedId == null) return;
    const template = templates.find((item) => item.id === selectedId);
    if (!window.confirm(`Delete “${template ? template.title : 'this template'}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.potfDelete(selectedId);
      await reload();
      setSelectedId(null);
      setForm(null);
      setNotice({ tone: 'info', text: 'Template deleted.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const intentionCount = form ? form.intentions.split('\n').filter((line) => line.trim()).length : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card
        title="Templates"
        subtitle={`${templates.length} in the book`}
        actions={
          <>
            <Button size="sm" icon={ClipboardPaste} onClick={startTypeIn}>
              Type in
            </Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={startNew}>
              New
            </Button>
          </>
        }
        bodyClassName="p-3"
      >
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-stone-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles and intentions"
              className="pl-8"
            />
          </div>
          <Select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}>
            <option value="">All seasons</option>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </Select>
        </div>

        <ul className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto scroll-slim">
          {filtered.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => select(template)}
                className={cx(
                  'w-full rounded-lg px-3 py-2 text-left transition-colors',
                  selectedId === template.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-100',
                )}
              >
                <span className="block truncate text-sm font-medium">{template.title}</span>
                <span
                  className={cx(
                    'mt-0.5 block text-xs',
                    selectedId === template.id ? 'text-stone-300' : 'text-stone-500',
                  )}
                >
                  {template.season}
                  {template.week ? ` · week ${template.week}` : ''}
                  {template.dayOfWeek ? ` · ${template.dayOfWeek}` : ''}
                  {` · ${template.intentions.length} intentions`}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-stone-500">Nothing matches that search.</li>
          )}
        </ul>
      </Card>

      <div className="space-y-4">
        {notice && (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}

        {selectedId === 'import' ? (
          <TypeInCard
            seasons={seasons}
            onCancel={() => setSelectedId(null)}
            onSaved={async (template) => {
              await reload();
              setSelectedId(template.id);
              setNotice({ tone: 'success', text: `Added “${template.title}”.` });
            }}
          />
        ) : !form ? (
          <Card>
            <EmptyState icon={BookOpen} title="Pick a template to edit">
              These are the intercessions LiturgyGen prints. Use <strong>Type in</strong> to add a
              day straight from your General Intercessions volumes — type it as it is printed and
              the parts are worked out for you.
            </EmptyState>
          </Card>
        ) : (
          <Card
            title={selectedId === 'new' ? 'New template' : 'Edit template'}
            subtitle="The most exact match is used. A prayer for one weekday beats a prayer for the whole season."
            actions={
              <>
                {selectedId !== 'new' && (
                  <>
                    <Button size="sm" icon={Copy} onClick={duplicate} disabled={busy}>
                      Duplicate
                    </Button>
                    <Button size="sm" variant="danger" icon={Trash2} onClick={remove} disabled={busy}>
                      Delete
                    </Button>
                  </>
                )}
                <Button size="sm" variant="primary" icon={Save} onClick={save} loading={busy}>
                  Save
                </Button>
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" className="md:col-span-2">
                <Input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Advent, Week 1 — Wednesday"
                />
              </Field>

              <Field label="Season">
                <Select
                  value={form.season}
                  onChange={(event) => setForm({ ...form, season: event.target.value })}
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Week" hint="1–34, or blank to match any week">
                <Input
                  type="number"
                  min="1"
                  max="34"
                  value={form.week}
                  onChange={(event) => setForm({ ...form, week: event.target.value })}
                  placeholder="Any"
                />
              </Field>

              <Field label="Day of week" hint="Blank matches any day">
                <Select
                  value={form.dayOfWeek}
                  onChange={(event) => setForm({ ...form, dayOfWeek: event.target.value })}
                >
                  <option value="">Any day</option>
                  {WEEKDAY_NAMES.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priest — invitation" className="md:col-span-2">
                <Textarea
                  rows={3}
                  value={form.priestInvitation}
                  onChange={(event) => setForm({ ...form, priestInvitation: event.target.value })}
                />
              </Field>

              <Field label="Response options" hint="One per line; printed with OR between them.">
                <Textarea
                  rows={4}
                  value={form.responseOptions}
                  onChange={(event) => setForm({ ...form, responseOptions: event.target.value })}
                />
              </Field>

              <Field
                label="Intentions"
                hint={`One per line, without numbering. ${intentionCount} entered — 4 to 6 is usual.`}
              >
                <Textarea
                  rows={8}
                  value={form.intentions}
                  onChange={(event) => setForm({ ...form, intentions: event.target.value })}
                />
              </Field>

              <Field
                label="Priest — concluding prayer"
                hint="“Amen.” is added automatically if you leave it off."
                className="md:col-span-2"
              >
                <Textarea
                  rows={3}
                  value={form.priestConclusion}
                  onChange={(event) => setForm({ ...form, priestConclusion: event.target.value })}
                />
              </Field>

            </div>

            {/* Two fields almost nobody needs: one binds a prayer to a single
                feast, the other is a private reminder. Folded so the form reads
                as the prayer itself. */}
            <Disclosure label="More settings" className="mt-4">
              <div className="space-y-4">
                <Field
                  label="Use only on one feast"
                  hint="Leave blank unless this prayer belongs to a single celebration."
                >
                  <Input
                    value={form.celebrationId}
                    onChange={(event) => setForm({ ...form, celebrationId: event.target.value })}
                    placeholder="Blank for normal use"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="Your own note" hint="Never printed.">
                  <Input
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </Field>
              </div>
            </Disclosure>

            {intentionCount > 0 && intentionCount < 4 && (
              <Alert tone="warn" className="mt-4">
                Only {intentionCount} intention{intentionCount === 1 ? '' : 's'}. Most of our
                missalettes print four to six.
              </Alert>
            )}
          </Card>
        )}

        {form && (
          <Card title="How it will print" bodyClassName="bg-stone-100 p-4">
            <div className="missalette mx-auto max-w-2xl rounded-lg bg-white px-10 py-8 text-[15px] leading-snug shadow-sm ring-1 ring-stone-200">
              <p className="text-center font-bold">
                {form.title ? form.title.toUpperCase() : 'LITURGICAL TITLE'}
              </p>
              {form.priestInvitation && (
                <p className="mt-2 text-justify font-bold">
                  <span className="font-bold">Priest:</span> {form.priestInvitation}
                </p>
              )}
              {form.responseOptions
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((response, index) => (
                  <div key={index}>
                    {index > 0 && <p className="my-2 text-center font-bold">OR</p>}
                    <p className="text-center font-bold">{response.toUpperCase()}</p>
                  </div>
                ))}
              <div className="mt-3 space-y-3">
                {form.intentions
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((intention, index) => (
                    <p key={index} className="text-justify">
                      {index + 1}. {/[.?!]$/.test(intention) ? intention : `${intention}.`}{' '}
                      <span className="font-bold italic">Let us pray to the Lord.</span>
                    </p>
                  ))}
              </div>
              {form.priestConclusion && (
                <p className="mt-3 text-justify font-bold">
                  <span className="font-bold italic">Priest:</span>{' '}
                  {/amen\.?$/i.test(form.priestConclusion.trim())
                    ? form.priestConclusion.trim()
                    : `${form.priestConclusion.trim()} Amen.`}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
