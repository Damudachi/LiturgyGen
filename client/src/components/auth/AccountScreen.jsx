import { useState } from 'react';
import { Building2, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { Alert, Button, Card } from '../ui.jsx';

function Row({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-tile text-navy ring-1 ring-tile-edge">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="font-serif text-lg break-words text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Who you are signed in as and which parish you are working in.
 *
 * It is read-only on purpose. Changing an email address or a password is
 * account recovery as much as it is a setting - it needs a confirmation link to
 * the old address, and getting that wrong is how an account is taken over. That
 * belongs in Supabase's own flows rather than in a form here, so this screen
 * states the facts and gets out of the way.
 *
 * The one action it does carry is signing out, which is the one people actually
 * come looking for on a shared office computer.
 */
export default function AccountScreen({ account, onSignedOut }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await supabase?.auth.signOut();
    } finally {
      // Sign out locally whatever the network said. A failed call must not
      // leave somebody looking at a signed-in screen on a shared machine.
      onSignedOut?.();
    }
  }

  if (account?.authDisabled) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Card title="Accounts are switched off">
          <Alert tone="info">
            This copy of LiturgyGen is running without accounts, which is how a local development
            checkout and the installed desktop build work. Everything is stored in the one database
            this server is pointed at.
          </Alert>
        </Card>
      </div>
    );
  }

  const { user, organisation } = account || {};

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-serif text-[30px] font-semibold text-ink">Account</h1>
      <p className="mt-1 text-muted">Who you are signed in as, and the parish you are working in.</p>

      <Card className="mt-6" title="You">
        <div className="divide-y divide-edge">
          <Row icon={Mail} label="Email address" value={user?.email || '—'} />
          <Row
            icon={ShieldCheck}
            label="Role in this parish"
            value={organisation?.role === 'owner' ? 'Owner' : 'Member'}
            hint={
              organisation?.role === 'owner'
                ? 'You created this parish.'
                : 'You were added to this parish.'
            }
          />
        </div>
      </Card>

      <Card className="mt-5" title="Parish">
        <div className="divide-y divide-edge">
          <Row
            icon={Building2}
            label="Name"
            value={organisation?.name || 'No parish yet'}
            hint={
              organisation
                ? 'Your prayer library, house style and Mass schedule all belong to this parish. Everyone in it shares them.'
                : undefined
            }
          />
        </div>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" icon={LogOut} loading={busy} disabled={busy} onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
