import { Copy, Save, Trash2 } from 'lucide-react';
import { WEEKDAY_NAMES } from '../../lib/dates';
import { Alert, Button, Disclosure, Field, Input, Select, Textarea } from '../ui';

export const BLANK = {
  title: '',
  season: 'Ordinary Time',
  week: '',
  dayOfWeek: '',
  celebrationId: '',
  fixedDate: '',
  priestInvitation: '',
  responseOptions: 'LORD, HEAR OUR PRAYER.',
  intentions: '',
  priestConclusion: '',
  notes: '',
};

export const toForm = (template) => ({
  title: template.title || '',
  season: template.season,
  week: template.week == null ? '' : String(template.week),
  dayOfWeek: template.dayOfWeek || '',
  celebrationId: template.celebrationId || '',
  fixedDate: template.fixedDate || '',
  priestInvitation: template.priestInvitation || '',
  responseOptions: (template.responseOptions || []).join('\n'),
  intentions: (template.intentions || []).join('\n'),
  priestConclusion: template.priestConclusion || '',
  notes: template.notes || '',
});

export const toPayload = (form) => ({
  title: form.title.trim(),
  season: form.season,
  week: form.week === '' ? null : Number(form.week),
  dayOfWeek: form.dayOfWeek || null,
  celebrationId: form.celebrationId.trim() || null,
  fixedDate: form.fixedDate.trim() || null,
  priestInvitation: form.priestInvitation.trim(),
  responseOptions: form.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean),
  intentions: form.intentions.split('\n').map((s) => s.trim()).filter(Boolean),
  priestConclusion: form.priestConclusion.trim(),
  notes: form.notes.trim() || null,
});

/** The left page of a template's book. */
export default function TemplateForm({ form, setForm, seasons, isNew, isPlaceholder, busy, onSave, onDuplicate, onDelete }) {
  const bind = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  const intentionCount = form.intentions.split('\n').filter((line) => line.trim()).length;

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold">{isNew ? 'New prayer' : 'Edit prayer'}</h2>
      <p className="mt-1 text-sm text-muted">The most exact match is used: a prayer for one weekday beats one for the whole season.</p>
      {isPlaceholder && (
        <Alert tone="warn" className="mt-3">
          This is a placeholder written for LiturgyGen, not a prayer from the books. Once you change its words it becomes your own.
        </Alert>
      )}

      <div className="mt-5 space-y-4">
        <Field label="Title">
          <Input {...bind('title')} placeholder="Ordinary Time, Week 1 - Monday" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1.9fr_0.8fr_1.3fr]">
          <Field label="Season">
            <Select {...bind('season')}>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Week" hint="1–34, or blank">
            <Input type="number" min="1" max="34" {...bind('week')} placeholder="Any" />
          </Field>
          <Field label="Day" hint="Blank for any day">
            <Select {...bind('dayOfWeek')}>
              <option value="">Any day</option>
              {WEEKDAY_NAMES.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Priest's invitation">
          <Textarea rows={3} {...bind('priestInvitation')} />
        </Field>
        <Field label="Responses" hint="One per line; printed with OR between them.">
          <Textarea rows={2} {...bind('responseOptions')} />
        </Field>
        <Field label="Intentions" hint={`One per line, without numbers. ${intentionCount} entered; four to six is usual.`}>
          <Textarea rows={7} {...bind('intentions')} />
        </Field>
        <Field label="Priest's concluding prayer" hint="“Amen.” is added when it prints.">
          <Textarea rows={3} {...bind('priestConclusion')} />
        </Field>
        <Disclosure label="More settings">
          <div className="space-y-4">
            <Field label="Use only on one feast" hint="Leave blank unless this prayer belongs to a single celebration.">
              <Input {...bind('celebrationId')} placeholder="Blank for normal use" className="font-mono text-sm" />
            </Field>
            <Field label="Calendar date" hint="MM-DD, for days the book fixes to a date.">
              <Input {...bind('fixedDate')} placeholder="01-02" />
            </Field>
            <Field label="Your own note" hint="Never printed.">
              <Input {...bind('notes')} />
            </Field>
          </div>
        </Disclosure>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-edge pt-4">
        <Button variant="primary" icon={Save} onClick={onSave} loading={busy}>
          Save
        </Button>
        {!isNew && (
          <>
            <Button icon={Copy} onClick={onDuplicate} disabled={busy}>
              Duplicate
            </Button>
            <Button variant="ghost" icon={Trash2} onClick={onDelete} disabled={busy} className="text-bad">
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** The right page: the prayer as it will print. */
export function PrayerPrint({ form }) {
  const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <div className="missalette">
      <p className="text-center font-bold">{form.title ? form.title.toUpperCase() : 'HEADING'}</p>
      {form.priestInvitation && (
        <p className="mt-2 text-justify font-bold">Priest: {form.priestInvitation}</p>
      )}
      {lines(form.responseOptions).map((response, index) => (
        <div key={index}>
          {index > 0 && <p className="my-2 text-center font-bold">OR</p>}
          <p className="text-center font-bold">{response.toUpperCase()}</p>
        </div>
      ))}
      <div className="mt-3 space-y-3">
        {lines(form.intentions).map((intention, index) => (
          <p key={index} className="text-justify">
            {index + 1}. {/[.?!]$/.test(intention) ? intention : `${intention}.`} <span className="font-bold italic">Let us pray to the Lord.</span>
          </p>
        ))}
      </div>
      {form.priestConclusion && (
        <p className="mt-3 text-justify font-bold">
          <span className="italic">Priest:</span>{' '}
          {/amen\.?$/i.test(form.priestConclusion.trim()) ? form.priestConclusion.trim() : `${form.priestConclusion.trim()} Amen.`}
        </p>
      )}
    </div>
  );
}
