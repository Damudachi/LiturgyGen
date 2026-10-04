import { useState } from 'react';
import { api } from '../../api';
import { Alert, Button, Field, Input } from '../ui.jsx';
import EntryLayout from './EntryLayout.jsx';

const POINTS = [
  {
    claim: 'One library, shared by the office.',
    detail:
      'Everyone you add to the parish works from the same prayers, the same house style and the same Mass schedule.',
  },
  {
    claim: 'Nobody else can see it.',
    detail:
      'Prayers, settings and finished documents are scoped to this parish, and a parish is only reachable by the people in it.',
  },
  {
    claim: 'The name is yours to change.',
    detail: 'It appears to your own staff and nowhere else, so an approximation now is no trouble later.',
  },
];

/**
 * The screen between confirming an email and having somewhere to put prayers.
 *
 * A fresh account belongs to no parish, and almost nothing in the app makes
 * sense in that state: the prayer library, the settings and the Mass schedule
 * all belong to a parish rather than to a person. So this is the only thing
 * such an account can see, and founding a parish is the only way out of it.
 *
 * Joining an existing parish by invitation is the obvious next feature and is
 * deliberately not here: an invitation needs an email flow and a token with an
 * expiry, and a half-built one would be a way into somebody else's prayer
 * library. Founding is the whole of it for now, and the copy says so.
 */
export default function ParishSetup({ email, onReady, onSignOut }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Enter the name of your parish or chapel.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { organisation, seededPrayers } = await api.createOrganisation(trimmed);
      onReady?.(organisation, seededPrayers);
    } catch (problem) {
      setError(problem.message || 'That did not work. Try again.');
      setBusy(false);
    }
  }

  return (
    <EntryLayout
      headline="Name your parish, and the library is yours."
      lede="A parish is where everything LiturgyGen makes is kept — the prayers you transcribe, the way you like them set, and the Masses you prepare for."
      points={POINTS}
    >
      <h2 className="font-serif text-[32px] leading-tight font-bold text-navy">Set up your parish</h2>
      <p className="mt-2 text-muted">Signed in as {email}.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field
          label="Parish or chapel name"
          htmlFor="parish-name"
          hint="You can change this later. It is only shown to your own staff."
        >
          <Input
            id="parish-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Chapel of the Holy Guardian Angel"
            disabled={busy}
            maxLength={120}
            required
          />
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        <Alert tone="info">
          A set of placeholder prayers is added so the library is not empty. They are written for
          this tool, not taken from either published book &mdash; your own transcriptions replace
          them as you type them in.
        </Alert>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          disabled={busy}
          className="mt-2 w-full justify-center"
        >
          Create parish
        </Button>
      </form>

      <p className="mt-8 border-t border-edge pt-6 text-sm text-muted">
        Wrong account?{' '}
        <button
          type="button"
          onClick={onSignOut}
          className="cursor-pointer font-semibold text-navy underline underline-offset-2 hover:text-ink"
        >
          Sign out
        </button>
      </p>
    </EntryLayout>
  );
}
