import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Church, Layers, Settings2 } from 'lucide-react';
import api from './api';
import SingleDateTab from './components/SingleDateTab';
import BatchTab from './components/BatchTab';
import TemplatesTab from './components/TemplatesTab';
import SettingsPanel from './components/SettingsPanel';
import { Alert, Spinner, cx } from './components/ui';

const TABS = [
  { id: 'single', label: 'One day', icon: CalendarDays },
  { id: 'batch', label: 'Many days', icon: Layers },
  { id: 'templates', label: 'Prayers', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function App() {
  const [tab, setTab] = useState('single');
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [health, setHealth] = useState(null);
  const [bootError, setBootError] = useState(null);

  const loadTemplates = useCallback(async () => {
    const payload = await api.potfList({ includeInactive: false });
    setTemplates(payload.templates);
  }, []);

  useEffect(() => {
    Promise.all([api.health(), api.settings(), api.potfMeta(), api.potfList()])
      .then(([healthPayload, settingsPayload, meta, list]) => {
        setHealth(healthPayload);
        setSettings(settingsPayload.settings);
        setSeasons(meta.seasons);
        setTemplates(list.templates);
      })
      .catch((error) => setBootError(error.message));
  }, []);

  if (bootError) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="error" title="Cannot reach the LiturgyGen server">
          <p>{bootError}</p>
          <p className="mt-2">
            Start it with <code className="rounded bg-red-100 px-1 py-0.5">npm run dev</code> from
            the project folder, then reload this page.
          </p>
        </Alert>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500">
        <Spinner /> Loading LiturgyGen…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[100rem] items-center gap-3 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-stone-900 text-white">
            <Church className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-semibold text-stone-900">LiturgyGen</h1>
            <p className="truncate text-xs text-stone-500">
              Campus Ministry Office · daily Mass missalettes and Prayers of the Faithful
            </p>
          </div>
          {/* The calendar and request-spacing details live in Settings; they are
              not something the office needs on screen while working. */}
        </div>

        <nav className="mx-auto flex max-w-[100rem] gap-1 px-3">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cx(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-base font-medium transition-colors',
                tab === entry.id
                  ? 'border-amber-700 text-stone-900'
                  : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800',
              )}
            >
              <entry.icon className="size-5" />
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[100rem] p-4">
        {tab === 'single' && <SingleDateTab settings={settings} templates={templates} />}
        {tab === 'batch' && <BatchTab settings={settings} />}
        {tab === 'templates' && (
          <TemplatesTab templates={templates} seasons={seasons} reload={loadTemplates} />
        )}
        {tab === 'settings' && <SettingsPanel settings={settings} onSaved={setSettings} />}
      </main>
    </div>
  );
}
