import { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import api from '../../api';
import Book from '../Book';
import { Alert, EmptyState } from '../ui';
import TemplateForm, { BLANK, PrayerPrint, toForm, toPayload } from './TemplateForm';
import TemplateList from './TemplateList';
import TypeInPrayer from './TypeInPrayer';

/** The prayers LiturgyGen prints: a list on the left, the chosen one as a book. */
export default function PrayersScreen({ templates, seasons, reload }) {
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
    if (selectedId == null || typeof selectedId !== 'number') return;
    const template = templates.find((item) => item.id === selectedId);
    if (template) setForm(toForm(template));
  }, [selectedId, templates]);

  const selected = typeof selectedId === 'number' ? templates.find((item) => item.id === selectedId) : null;

  const guard = async (fn) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    guard(async () => {
      const payload = toPayload(form);
      const saved = selectedId === 'new' ? await api.potfCreate(payload) : await api.potfUpdate(selectedId, payload);
      await reload();
      setSelectedId(saved.id);
      setNotice({ tone: 'success', text: `Saved “${saved.title}”.` });
    });

  const duplicate = () =>
    guard(async () => {
      const copy = await api.potfDuplicate(selectedId);
      await reload();
      setSelectedId(copy.id);
      setNotice({ tone: 'success', text: 'Duplicated. Edit the copy and save it.' });
    });

  const remove = () => {
    if (!window.confirm(`Delete “${selected ? selected.title : 'this prayer'}”? This cannot be undone.`)) return;
    guard(async () => {
      await api.potfDelete(selectedId);
      await reload();
      setSelectedId(null);
      setForm(null);
      setNotice({ tone: 'info', text: 'Prayer deleted.' });
    });
  };

  let main;
  if (selectedId === 'import') {
    main = (
      <TypeInPrayer
        seasons={seasons}
        onCancel={() => setSelectedId(null)}
        onSaved={async (template) => {
          await reload();
          setSelectedId(template.id);
          setNotice({ tone: 'success', text: `Added “${template.title}”.` });
        }}
      />
    );
  } else if (form && selectedId != null) {
    main = (
      <Book
        variant="inline"
        label={form.title || 'New prayer'}
        onClose={() => {
          setSelectedId(null);
          setForm(null);
        }}
        left={
          <TemplateForm
            form={form}
            setForm={setForm}
            seasons={seasons}
            isNew={selectedId === 'new'}
            isPlaceholder={Boolean(selected && selected.isPlaceholder)}
            busy={busy}
            onSave={save}
            onDuplicate={duplicate}
            onDelete={remove}
          />
        }
        right={<PrayerPrint form={form} />}
      />
    );
  } else {
    main = (
      <div className="grid h-full place-items-center rounded-md bg-page ring-1 ring-edge">
        <EmptyState icon={BookOpen} title="Choose a prayer to open it">
          These are the Prayers of the Faithful LiturgyGen prints. Use Type in to add a day straight from the General Intercessions books.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-60px)] min-h-[36rem] gap-5 p-5 max-[1023px]:h-auto min-[1024px]:grid-cols-[22rem_minmax(0,1fr)]">
      <TemplateList
        templates={filtered}
        total={templates.length}
        seasons={seasons}
        search={search}
        onSearch={setSearch}
        seasonFilter={seasonFilter}
        onSeasonFilter={setSeasonFilter}
        selectedId={selectedId}
        onSelect={(template) => {
          setSelectedId(template.id);
          setForm(toForm(template));
          setNotice(null);
        }}
        onNew={() => {
          setSelectedId('new');
          setForm({ ...BLANK });
          setNotice(null);
        }}
        onTypeIn={() => {
          setSelectedId('import');
          setForm(null);
          setNotice(null);
        }}
      />
      <div className="flex min-h-0 flex-col gap-3">
        {notice && (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
        <div className="min-h-0 flex-1 [&>.book-gutter]:h-full">{main}</div>
      </div>
    </div>
  );
}
