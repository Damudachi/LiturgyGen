import { useState } from 'react';
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
export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const signingUp = mode === 'up';

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
          options: { emailRedirectTo: window.location.origin },
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
