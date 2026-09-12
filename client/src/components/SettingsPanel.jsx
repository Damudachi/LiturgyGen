import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import api from '../api';
import { Alert, Button, Card, Checkbox, Field, Input, Textarea } from './ui';

/** Document defaults. These become the style overrides docxService receives. */
export default function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState({
    ...settings,
    schoolWideIntentions: (settings.schoolWideIntentions || []).join('\n'),
  });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy('save');
    setNotice(null);
    try {
      const payload = await api.saveSettings({
        includeGospel: form.includeGospel,
        includeSequence: form.includeSequence,
        separatePages: form.separatePages,
        highlightFirstRefrain: form.highlightFirstRefrain,
        repeatPsalmRefrain: form.repeatPsalmRefrain,
        firstRefrainUppercase: form.firstRefrainUppercase,
        appendIntentionSuffix: form.appendIntentionSuffix,
        spaceBetweenIntentions: form.spaceBetweenIntentions,
        font: form.font,
        usePlaceholderPotf: form.usePlaceholderPotf,
        schoolWideIntentions: form.schoolWideIntentions
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      onSaved(payload.settings);
      setNotice({ tone: 'success', text: 'Settings saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message });
    } finally {
      setBusy(null);
    }
  };

  const clearCache = async () => {
    setBusy('cache');
    try {
      await api.clearCache();
      setNotice({
        tone: 'info',
        text: 'Cached readings cleared. The next generation will fetch them again.',
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <Card
        title="Document defaults"
        subtitle="Applied to every document generated from now on."
        actions={
          <Button variant="primary" size="sm" icon={Save} onClick={save} loading={busy === 'save'}>
            Save
          </Button>
        }
      >
        <div className="space-y-3">
          <Checkbox
            label="Print the Gospel"
            hint="Off by default — our missalette stops after the acclamation, since the Gospel is proclaimed from the lectionary."
            checked={form.includeGospel}
            onChange={(event) => set('includeGospel', event.target.checked)}
          />
          <Checkbox
            label="Start each reading on its own page"
            hint="The first reading, the second reading and the prayers each open a fresh page. The psalm and the Alleluia are left together."
            checked={form.separatePages}
            onChange={(event) => set('separatePages', event.target.checked)}
          />
          <Checkbox
            label="Highlight the first psalm response"
            hint="Marks the response the assembly has to find, as in the office sample."
            checked={form.highlightFirstRefrain}
            onChange={(event) => set('highlightFirstRefrain', event.target.checked)}
          />
          <Checkbox
            label="Print the Sequence when there is one"
            hint="Easter, Pentecost, Corpus Christi and Our Lady of Sorrows."
            checked={form.includeSequence}
            onChange={(event) => set('includeSequence', event.target.checked)}
          />
          <Checkbox
            label="Repeat the psalm response between stanzas"
            checked={form.repeatPsalmRefrain}
            onChange={(event) => set('repeatPsalmRefrain', event.target.checked)}
          />
          <Checkbox
            label="Print the first psalm response in capitals"
            checked={form.firstRefrainUppercase}
            onChange={(event) => set('firstRefrainUppercase', event.target.checked)}
          />
          <Checkbox
            label="Append “Let us pray to the Lord.” to each intention"
            checked={form.appendIntentionSuffix}
            onChange={(event) => set('appendIntentionSuffix', event.target.checked)}
          />
          <Checkbox
            label="Leave a blank line between intentions"
            checked={form.spaceBetweenIntentions}
            onChange={(event) => set('spaceBetweenIntentions', event.target.checked)}
          />
        </div>

        <div className="mt-4 border-t border-stone-200 pt-4">
          <Field
            label="Document font"
            hint="Book Antiqua matches the office's existing missalettes. Whatever you choose must be installed on the computer that opens the file."
          >
            <Input value={form.font} onChange={(event) => set('font', event.target.value)} />
          </Field>
        </div>
      </Card>

      <Card
        title="Prayers of the Faithful"
        subtitle="The Proper of Seasons, Solemnities and Feasts book first, then the Ordinary Time book for the same day."
      >
        <Checkbox
          label="Use a placeholder prayer when neither book has one"
          hint="Off by default. Both books are for weekday Masses, so Sundays have no prayer in either; those days are printed without intercessions and flagged, unless you choose a prayer for the day yourself."
          checked={Boolean(form.usePlaceholderPotf)}
          onChange={(event) => set('usePlaceholderPotf', event.target.checked)}
        />
      </Card>

      <Card title="Standing school-wide intentions" subtitle="Added to every generated day.">
        <Textarea
          rows={4}
          value={form.schoolWideIntentions}
          onChange={(event) => set('schoolWideIntentions', event.target.value)}
          placeholder={'For our benefactors, living and departed\nFor the intentions of our school community'}
        />
        <p className="mt-2 text-xs text-stone-500">
          One per line. A batch can add its own on top of these.
        </p>
      </Card>

      <Card title="Cached readings" subtitle="Readings for a past date never change, so they are kept forever.">
        <Button icon={Trash2} onClick={clearCache} loading={busy === 'cache'}>
          Clear the readings cache
        </Button>
        <p className="mt-2 text-xs text-stone-500">
          Hand-typed corrections are stored separately and are not affected.
        </p>
      </Card>
    </div>
  );
}
