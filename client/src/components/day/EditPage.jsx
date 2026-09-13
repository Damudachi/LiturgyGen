import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { Button, Field, Input, Textarea } from '../ui';

const linesToText = (lines) => (lines || []).join('\n');
const textToLines = (text) => text.split('\n').map((line) => line.trimEnd());

/** Everything on the page that can be corrected, as editable text. */
export function draftFromDay(day) {
  const readings = (day && day.readings) || {};
  return {
    reading1Intro: (readings.reading1 && readings.reading1.intro) || '',
    reading1Citation: (readings.reading1 && readings.reading1.citation) || '',
    reading1Text: linesToText(readings.reading1 && readings.reading1.lines),
    psalmCitation: (readings.psalm && readings.psalm.citation) || '',
    psalmRefrain: (readings.psalm && readings.psalm.refrain) || '',
    psalmStanzas: ((readings.psalm && readings.psalm.stanzas) || []).map((stanza) => stanza.join('\n')).join('\n\n'),
    acclamationRefrain: (readings.acclamation && readings.acclamation.refrain) || 'Alleluia, alleluia.',
    acclamationVerse: linesToText(readings.acclamation && readings.acclamation.verse),
    potfTitle: day.potfTitle || day.occasionTitle || '',
    priestInvitation: (day.potf && day.potf.priestInvitation) || '',
    responseOptions: ((day.potf && day.potf.responseOptions) || []).join('\n'),
    intentions: ((day.potf && day.potf.intentions) || []).join('\n'),
    priestConclusion: (day.potf && day.potf.priestConclusion) || '',
  };
}

/** The draft as the preview and the /generate endpoint want it. */
export function payloadFromDraft(draft, day) {
  const readings = day.readings || {};
  return {
    readingsOverride: {
      ...readings,
      reading1: readings.reading1
        ? { ...readings.reading1, intro: draft.reading1Intro || null, citation: draft.reading1Citation || null, lines: textToLines(draft.reading1Text) }
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
    potfTitle: draft.potfTitle,
    potfOverride: {
      priestInvitation: draft.priestInvitation,
      responseOptions: draft.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean),
      intentions: draft.intentions.split('\n').map((s) => s.trim()).filter(Boolean),
      priestConclusion: draft.priestConclusion,
    },
  };
}

/** The left page while editing; the right page shows the result as you type. */
export default function EditPage({ draft, setDraft, busy, onSave, onRevert, onBack }) {
  const bind = (key) => ({ value: draft[key], onChange: (event) => setDraft({ ...draft, [key]: event.target.value }) });

  return (
    <div>
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-3">
        Back to the day
      </Button>
      <h2 className="mt-2 font-serif text-2xl font-bold">Edit this page</h2>
      <p className="mt-1 text-sm text-muted">Changes show on the right straight away and go into the download.</p>

      <div className="mt-5 space-y-4">
        <Field label="Heading above the intercessions">
          <Input {...bind('potfTitle')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First reading citation">
            <Input {...bind('reading1Citation')} />
          </Field>
          <Field label="First reading introduction">
            <Input {...bind('reading1Intro')} />
          </Field>
        </div>
        <Field label="First reading text" hint="One lectionary line per row; a blank row for a stanza break.">
          <Textarea rows={7} {...bind('reading1Text')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Psalm citation">
            <Input {...bind('psalmCitation')} />
          </Field>
          <Field label="Psalm response">
            <Input {...bind('psalmRefrain')} />
          </Field>
        </div>
        <Field label="Psalm verses" hint="A blank line between stanzas.">
          <Textarea rows={7} {...bind('psalmStanzas')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Acclamation response">
            <Input {...bind('acclamationRefrain')} />
          </Field>
          <Field label="Acclamation verse">
            <Textarea rows={2} {...bind('acclamationVerse')} />
          </Field>
        </div>
        <Field label="Priest's invitation">
          <Textarea rows={3} {...bind('priestInvitation')} />
        </Field>
        <Field label="Responses" hint="One per line; printed with OR between them.">
          <Textarea rows={2} {...bind('responseOptions')} />
        </Field>
        <Field label="Intentions" hint="One per line, without numbers.">
          <Textarea rows={6} {...bind('intentions')} />
        </Field>
        <Field label="Priest's concluding prayer">
          <Textarea rows={3} {...bind('priestConclusion')} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
        <Button variant="primary" icon={Save} onClick={onSave} loading={busy === 'save'}>
          Save corrections
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={onRevert} loading={busy === 'revert'}>
          Undo saved corrections
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Saving keeps the reading text for this date. To change the prayers for every year, edit them under Prayers.
      </p>
    </div>
  );
}
