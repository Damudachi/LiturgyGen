/**
 * The browser's Supabase client: sessions, nothing else.
 *
 * It signs in, signs out, and keeps the access token fresh. It does NOT read or
 * write the office's data - every one of those goes through our own API, which
 * is where the parish scoping lives. Two paths to the same tables would be two
 * places to get the scoping wrong.
 *
 * The key here is the PUBLISHABLE key and it is meant to be in the bundle;
 * anyone can read it out of the JavaScript, which is why Row Level Security is
 * on for every table. The service role key, which bypasses RLS, lives only on
 * the server and must never appear in a VITE_ variable - everything prefixed
 * VITE_ is compiled into a file the whole internet can download.
 */

import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** False in demo mode and in the desktop build, where nobody signs in. */
export const authEnabled = Boolean(URL && KEY);

export const supabase = authEnabled
  ? createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The session lands back on the page the link was clicked from.
        detectSessionInUrl: true,
      },
    })
  : null;

/** The current access token, or null. Every API call carries this. */
export async function accessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export default supabase;
