import { useCallback, useEffect, useState } from 'react';
import api from './api';
import Logo from './components/Logo';
import DemoNotice from './components/DemoNotice';
import CalendarScreen from './components/calendar/CalendarScreen';
import PrayersScreen from './components/prayers/PrayersScreen';
import SettingsPanel from './components/SettingsPanel';
import { Alert, Spinner, cx } from './components/ui';
import WindowControls, { inDesktopWindow, titleBarProps } from './components/WindowControls';
import AuthScreen from './components/auth/AuthScreen';
import ParishSetup from './components/auth/ParishSetup';
import AccountScreen from './components/auth/AccountScreen';
import EntryLayout from './components/auth/EntryLayout';
import ImportBook from './components/prayers/ImportBook';
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

  /*
   * The import step, shown once, straight after a parish is founded.
   *
   * It is local state rather than something stored on the parish, because it is
   * an offer and not a milestone: skipping it must not leave a flag behind that
   * something later has to interpret. The Prayers screen can reach the same
   * importer whenever the office wants it.
   */
  const [offerImport, setOfferImport] = useState(false);

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
        onReady={() => {
          setOfferImport(true);
          return api.account().then(setAccount);
        }}
        onSignOut={() => supabase?.auth.signOut()}
      />
    );
  }

  /*
   * A parish founded a moment ago holds placeholder prayers and nothing else,
   * so this is the one moment the office is certainly thinking about where its
   * real prayers come from. Offering the book here rather than burying it in a
   * tab is the difference between a library that gets filled and one that does
   * not.
   */
  if (offerImport) {
    return (
      <EntryLayout
        headline="Your library is waiting for your own prayers."
        lede="What is in there now is a placeholder set, written for this tool. Hand LiturgyGen your General Intercessions book and it will read the pages for you - or skip this and type them in whenever you like."
        points={[
          {
            claim: 'A PDF or a photograph will do.',
            detail:
              'A PDF with real text in it needs nothing installed. A scan or a photograph is read by character recognition instead.',
          },
          {
            claim: 'You approve every page.',
            detail:
              'Nothing reaches your library until you tick it. Recognition misreads words, and these are prayers somebody reads aloud.',
          },
          {
            claim: 'You can do this later.',
            detail: 'The same importer sits on the Prayers screen, and the placeholders work in the meantime.',
          },
        ]}
      >
        <ImportBook compact onSkip={() => setOfferImport(false)} onSaved={() => loadTemplates()} />
      </EntryLayout>
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
        <Logo className="h-8 w-10 shrink-0" />
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
