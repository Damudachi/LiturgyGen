import { useCallback, useEffect, useState } from 'react';
import api from './api';
import seal from './assets/seal-128.png';
import DemoNotice from './components/DemoNotice';
import CalendarScreen from './components/calendar/CalendarScreen';
import PrayersScreen from './components/prayers/PrayersScreen';
import SettingsPanel from './components/SettingsPanel';
import { Alert, Spinner, cx } from './components/ui';
import WindowControls, { inDesktopWindow, titleBarProps } from './components/WindowControls';
import AuthScreen from './components/auth/AuthScreen';
import ParishSetup from './components/auth/ParishSetup';
import AccountScreen from './components/auth/AccountScreen';
import { authEnabled, supabase } from './lib/supabase';

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'prayers', label: 'Prayers' },
  { id: 'settings', label: 'Settings' },
  { id: 'account', label: 'Account' },
];

export default function App() {
  const [tab, setTab] = useState('calendar');
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [bootError, setBootError] = useState(null);

  /*
   * `session` is undefined until we have asked, then null or a session. The
   * three states are deliberately distinct: rendering the sign-in screen while
   * still checking would flash it at somebody who is already signed in, every
   * single load.
   */
  const [session, setSession] = useState(authEnabled ? undefined : null);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (!authEnabled) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    // Fires on sign-in, sign-out and on every silent token refresh, which is
    // what keeps a long editing session from quietly expiring underneath you.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadTemplates = useCallback(async () => {
    const payload = await api.potfList({ includeInactive: false });
    setTemplates(payload.templates);
  }, []);

  // Who am I, and do I have a parish? Asked first, because the answer decides
  // whether the rest is worth fetching at all.
  useEffect(() => {
    if (authEnabled && !session) {
      setAccount(null);
      return;
    }
    api.account().then(setAccount).catch((error) => setBootError(error.message));
  }, [session]);

  const hasParish = Boolean(account && (account.authDisabled || account.organisation));

  useEffect(() => {
    // Not signed in, or signed in with no parish yet: there is nothing to load,
    // and asking would be four 401s and a misleading boot error.
    if (!account || !hasParish) return;

    Promise.all([api.health(), api.settings(), api.potfMeta(), api.potfList()])
      .then(([, settingsPayload, meta, list]) => {
        setSettings(settingsPayload.settings);
        setSeasons(meta.seasons);
        setTemplates(list.templates);
      })
      .catch((error) => setBootError(error.message));
  }, [account, hasParish]);

  if (authEnabled && session === undefined) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted">
        <Spinner /> Checking your session…
      </div>
    );
  }

  if (authEnabled && !session) {
    return <AuthScreen onSignedIn={() => setBootError(null)} />;
  }

  if (account && !hasParish) {
    return (
      <ParishSetup
        email={account.user?.email}
        onReady={() => api.account().then(setAccount)}
        onSignOut={() => supabase?.auth.signOut()}
      />
    );
  }

  if (bootError) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="error" title="LiturgyGen's server is not running">
          <p>{bootError}</p>
          <p className="mt-2">
            Start it with <code className="rounded bg-page-hi px-1 py-0.5">npm run dev</code> from the project folder, then reload this page.
          </p>
        </Alert>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted">
        <Spinner /> Opening LiturgyGen…
      </div>
    );
  }

  return (
    // In the desktop window the navbar is the title bar, so only the page below it
    // scrolls; its scrollbar never runs up beside the window buttons.
    <div className={inDesktopWindow ? 'flex h-full flex-col' : 'min-h-full'}>
      <header
        {...titleBarProps()}
        className={cx('on-dark sticky top-0 z-50 flex h-[60px] shrink-0 items-center gap-3 bg-ink px-6 text-page shadow-float', inDesktopWindow && 'select-none')}
      >
        <img src={seal} alt="Chapel of the Holy Guardian Angel seal" draggable={false} className="size-9 rounded-full" />
        <span className="font-serif text-xl font-bold">LiturgyGen</span>
        <nav className="ml-auto flex h-full gap-1" aria-label="Main">
          {/* No accounts in the desktop build or in demo mode, so the tab would
              open a screen explaining that it does not apply. Hide it instead. */}
          {TABS.filter((entry) => entry.id !== 'account' || authEnabled).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id ? 'page' : undefined}
              className={cx(
                'relative h-full cursor-pointer px-4 text-base font-medium transition-colors',
                tab === entry.id ? 'text-gold' : 'text-[#c9d3dc] hover:text-page',
              )}
            >
              {entry.label}
              {tab === entry.id && <span aria-hidden="true" className="absolute inset-x-4 bottom-0 h-[3px] rounded-t bg-gold" />}
            </button>
          ))}
        </nav>
        <WindowControls />
      </header>

      <main className={inDesktopWindow ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
        <DemoNotice />
        {tab === 'calendar' && <CalendarScreen settings={settings} templates={templates} />}
        {tab === 'prayers' && <PrayersScreen templates={templates} seasons={seasons} reload={loadTemplates} />}
        {tab === 'settings' && <SettingsPanel settings={settings} onSaved={setSettings} />}
        {tab === 'account' && (
          <AccountScreen account={account} onSignedOut={() => setSession(null)} />
        )}
      </main>
    </div>
  );
}
