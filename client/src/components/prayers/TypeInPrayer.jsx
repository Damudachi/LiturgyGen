import { useState } from 'react';
import { Save, Wand2 } from 'lucide-react';
import api from '../../api';
import { WEEKDAY_NAMES } from '../../lib/dates';
import Book from '../Book';
import { Alert, Button, Field, Input, Select, Textarea } from '../ui';
import { PrayerPrint } from './TemplateForm';

/**
 * Type a prayer as it is printed and the server splits it into its parts.
 * Left page: the typed page and where it belongs. Right page: what was understood.
 */
export default function TypeInPrayer({ seasons, onSaved, onCancel }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [where, setWhere] = useState({ season: 'Ordinary Time', week: '', dayOfWeek: '', fixedDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (event) => setWhere((prev) => ({ ...prev, [key]: event.target.value }));

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

  const left = (
    <div>
      <h2 className="font-serif text-[26px] font-bold">Type in a prayer from the book</h2>
      <p className="mt-1 text-sm text-muted">Type it exactly as it is printed. LiturgyGen works out the parts.</p>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <Field className="mt-4" label="The page" hint="Heading, the invitation, the response in CAPITALS, the numbered intentions, then the closing prayer.">
        <Textarea
          rows={14}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
          }}
          className="font-mono text-sm"
          placeholder={'SECOND OF FEBRUARY\n\nThe invitation the priest reads.\n\nLORD, HEAR OUR PRAYER.\n\nOr\n\nFATHER, HEAR US.\n\n1. That ... Let us pray to the Lord.\n2. That ... Let us pray to the Lord.\n\nThe closing prayer the priest reads. Amen.'}
        />
      </Field>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Season">
          <Select value={where.season} onChange={set('season')}>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Week" hint="Blank for any week">
          <Input type="number" min="1" max="34" value={where.week} onChange={set('week')} />
        </Field>
        <Field label="Day" hint="Blank for any day">
          <Select value={where.dayOfWeek} onChange={set('dayOfWeek')}>
            <option value="">Any day</option>
            {WEEKDAY_NAMES.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Calendar date" hint="MM-DD, for days the book fixes to a date">
          <Input placeholder="01-02" value={where.fixedDate} onChange={set('fixedDate')} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-edge pt-4">
        <Button icon={Wand2} onClick={check} disabled={busy || !text.trim()}>
          Check it
        </Button>
        <Button variant="primary" icon={Save} onClick={save} disabled={busy || !preview}>
          Add to the prayers
        </Button>
      </div>
    </div>
  );

  const right = preview ? (
    <div>
      {preview.warnings.length > 0 && (
        <Alert tone="warn" className="mb-4">
          <ul className="list-disc pl-4">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      <PrayerPrint
        form={{
          title: preview.title || '',
          priestInvitation: preview.priestInvitation,
          responseOptions: preview.responseOptions.join('\n'),
          intentions: preview.intentions.join('\n'),
          priestConclusion: preview.priestConclusion,
        }}
      />
      <p className="mt-4 text-sm text-muted">“Let us pray to the Lord.” and “Amen.” are added back when the document prints.</p>
    </div>
  ) : (
    <p className="text-muted">Press “Check it” to see how LiturgyGen reads the page.</p>
  );

  return <Book variant="inline" label="Type in a prayer" onClose={onCancel} left={left} right={right} />;
}
