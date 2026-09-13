import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { formatLong } from '../../lib/dates';
import Book from '../Book';
import { Spinner } from '../ui';
import DayPage from './DayPage';
import DocumentPreview from './DocumentPreview';
import EditPage, { draftFromDay, payloadFromDraft } from './EditPage';
import PasteReadings from './PasteReadings';
import PrayerPicker from './PrayerPicker';

/**
 * One day, opened as a book over the month. Left page: the day, or the editor,
 * the prayer picker, or the paste form. Right page: the missalette, always
 * showing unsaved edits so it matches the download.
 */
export default function DayBook({ iso, settings, templates, onClose }) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [page, setPage] = useState('day'); // day | edit | prayers | paste
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    async ({ force = false, template = templateId } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.preview({ date: iso, force, potfTemplateId: template ? Number(template) : null });
        setDay(payload);
        setDraft(null);
      } catch (err) {
        setError(err);
        setDay(null);
      } finally {
        setLoading(false);
      }
    },
    [iso, templateId],
  );

  useEffect(() => {
    load({ template: '' });
    // A new day starts from "choose for me".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  const dirty = useMemo(() => Boolean(draft && day && JSON.stringify(draft) !== JSON.stringify(draftFromDay(day))), [draft, day]);
  const payload = draft && day ? payloadFromDraft(draft, day) : null;

  const previewDay = useMemo(() => {
    // Unsaved edits stay visible on every left page, because they go into the download.
    if (!day || !payload || (page !== 'edit' && !dirty)) return day;
    return { ...day, potfTitle: payload.potfTitle, readings: payload.readingsOverride, potf: payload.potfOverride };
  }, [day, payload, page, dirty]);

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this day?')) return;
    onClose();
  };

  const run = (name, fn) => async (...args) => {
    setBusy(name);
    setNotice(null);
    try {
      await fn(...args);
    } catch (err) {
      setNotice({ tone: 'error', text: err.hint ? `${err.message} ${err.hint}` : err.message });
    } finally {
      setBusy(null);
    }
  };

  const download = run('download', async () => {
    const fileName = await api.generate({
      date: iso,
      potfTemplateId: templateId ? Number(templateId) : null,
      ...(dirty && payload ? payload : {}),
    });
    setNotice({ tone: 'success', text: `Downloaded ${fileName}` });
  });

  const save = run('save', async () => {
    await api.saveReadings(iso, payload.readingsOverride);
    await load();
    setPage('day');
    setNotice({ tone: 'success', text: `Corrections for ${formatLong(iso)} saved. They are used every time this date is made.` });
  });

  const revert = run('revert', async () => {
    await api.clearOverride(iso);
    await load({ force: true });
    setPage('day');
    setNotice({ tone: 'info', text: 'Saved corrections removed; the readings are back as published.' });
  });

  const importHtml = run('import', async (html) => {
    await api.importReadings(iso, html);
    await load();
    setPage('day');
    setNotice({ tone: 'success', text: 'Readings added from the pasted page.' });
  });

  const choosePrayers = async (value) => {
    setTemplateId(value);
    setPage('day');
    await load({ template: value });
  };

  const blocked = Boolean(error && ['USCCB_CHALLENGE', 'NO_PROVIDER'].includes(error.code)) ||
    Boolean(day && day.readingsError && ['USCCB_CHALLENGE', 'NO_PROVIDER'].includes(day.readingsError.code));

  let left;
  if (page === 'edit' && draft) {
    left = <EditPage draft={draft} setDraft={setDraft} busy={busy} onSave={save} onRevert={revert} onBack={() => setPage('day')} />;
  } else if (page === 'prayers') {
    left = <PrayerPicker templates={templates} templateId={templateId} onChoose={choosePrayers} onBack={() => setPage('day')} />;
  } else if (page === 'paste') {
    left = <PasteReadings iso={iso} busy={busy} onImport={importHtml} onBack={() => setPage('day')} />;
  } else {
    left = (
      <DayPage
        iso={iso}
        day={day}
        loading={loading}
        error={error && error.message}
        blocked={blocked}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        busy={busy}
        onEdit={() => {
          if (!draft) setDraft(draftFromDay(day));
          setPage('edit');
        }}
        onPrayers={() => setPage('prayers')}
        onRefresh={() => load({ force: true })}
        onPaste={() => setPage('paste')}
        onDownload={download}
      />
    );
  }

  const right =
    loading && !day ? (
      <div className="flex h-full items-center justify-center gap-2 text-muted">
        <Spinner /> Getting the readings…
      </div>
    ) : previewDay ? (
      <DocumentPreview day={previewDay} settings={settings} />
    ) : (
      <p className="text-muted">Nothing to show until the readings are found.</p>
    );

  return <Book label={`Missalette for ${formatLong(iso)}`} onClose={close} left={left} right={right} />;
}
