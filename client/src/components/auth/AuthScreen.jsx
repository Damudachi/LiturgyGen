import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Alert, Button, Field, Input } from '../ui.jsx';
import EntryLayout from './EntryLayout.jsx';

/**
 * Sign in, or sign up with an email address.
 *
 * This is the whole of the app a signed-out visitor can reach. It is one screen
 * with two modes rather than two screens, because the only difference is which
 * Supabase call runs and what the button says - and someone who typed their
 * email into the wrong one should not have to retype it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Nothing says whether an email address already has an account. "That address
 * is taken" turns a sign-up form into a tool for finding out who uses the app.
 * Supabase's own responses are deliberately vague about it too, and the message
 * below stays vague to match.
 */
/**
 * What a failed email link left in the address bar.
 *
 * Supabase reports these in the URL FRAGMENT, not in a response and not in a
 * callback: a dead confirmation link lands on
 * `/app#error=access_denied&error_code=otp_expired&...` and that is the entire
 * notification. Nothing throws, `getSession()` simply returns null, and without
 * this the visitor gets the plain sign-in form plus a line of noise in the
 * address bar explaining nothing.
 *
 * `error_description` is written for a developer ("Email link is invalid or has
 * expired"), so the one code that actually happens gets wording that says what
 * to do instead.
 */
function errorFromHash() {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;

  const params = new URLSearchParams(hash.slice(1));
  const code = params.get('error_code');
  if (!params.get('error') && !code) return null;

  if (code === 'otp_expired') {
    return 'That confirmation link has expired, or it had already been used. Sign in below if the account is confirmed, or create it again to be sent a fresh link.';
  }
  return params.get('error_description') || 'That link did not work. Sign in below, or ask for a new one.';
}


export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const signingUp = mode === 'up';

  // A dead email link is the only thing that arrives here as a URL fragment,
  // and it has to be read before anything clears it.
  useEffect(() => {
    const message = errorFromHash();
    if (!message) return;
    setNotice({ tone: 'error', text: message });
    // Take it out of the address bar, so reloading the page does not reopen a
    // complaint about a link the visitor has already dealt with.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setNotice(null);

    if (!email.trim() || !password) {
      setNotice({ tone: 'error', text: 'An email address and a password are both needed.' });
      return;
    }
    // Supabase enforces its own minimum; saying it here saves a round trip and
    // a confusing error from somebody else's service.
    if (signingUp && password.length < 8) {
      setNotice({ tone: 'error', text: 'Use a password of at least 8 characters.' });
      return;
    }

    setBusy(true);
    try {
      if (signingUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // /app, NOT the origin. The origin is the server-rendered landing
          // page, which has no React on it - a confirmation link that lands
          // there leaves the session sitting unread in the URL fragment and
          // the visitor looking at a page that cannot sign them in. This path
          // must also be on the Redirect URL allowlist in the Supabase
          // dashboard, or Supabase substitutes the project's Site URL and the
          // link goes wherever that points.
          options: { emailRedirectTo: new URL('/app', window.location.origin).href },
        });
        if (error) throw error;

        // A project with email confirmation ON returns a user with no session:
        // they must click the link first. With it OFF the session is there and
        // we are already signed in. Both are normal, and the difference is a
        // project setting rather than anything this code can decide.
        if (data.session) {
          onSignedIn?.();
        } else {
          setNotice({
            tone: 'info',
            text: `Check ${email.trim()} for a confirmation link, then sign in. It can take a minute to arrive.`,
          });
          setMode('in');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onSignedIn?.();
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || 'That did not work. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <EntryLayout>
      <h2 className="font-serif text-[32px] leading-tight font-bold text-navy">
        {signingUp ? 'Create an account' : 'Sign in'}
      </h2>
      <p className="mt-2 text-muted">
        {signingUp
          ? 'One account per person. You will name your parish on the next screen.'
          : 'For the office staff who prepare the worship aids.'}
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Email address" htmlFor="auth-email">
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="auth-password"
          hint={signingUp ? 'At least 8 characters.' : undefined}
        >
          <Input
            id="auth-password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
          />
        </Field>

        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          disabled={busy}
          className="mt-2 w-full justify-center"
        >
          {signingUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 border-t border-edge pt-6 text-sm text-muted">
        {signingUp ? 'Already have an account?' : 'No account yet?'}{' '}
        <button
          type="button"
          className="cursor-pointer font-semibold text-navy underline underline-offset-2 hover:text-ink"
          onClick={() => {
            setMode(signingUp ? 'in' : 'up');
            setNotice(null);
          }}
        >
          {signingUp ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </EntryLayout>
  );
}
