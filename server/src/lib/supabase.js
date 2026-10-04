/**
 * The Supabase admin client, used for one job only: turning an access token
 * from the browser into a user.
 *
 * WHY NOT TALK TO SUPABASE FOR EVERYTHING
 * ---------------------------------------
 * The database is reached the way it always was, through `pg` in src/db/index.js
 * with a direct connection string. Supabase is PostgreSQL, so none of that
 * changed. What this file adds is the identity half: Supabase issues the JWT
 * when somebody signs in, and only Supabase can say whether a given token is
 * real and whose it is.
 *
 * The server holds the SERVICE ROLE key, which bypasses Row Level Security. That
 * is deliberate and it is why every query in the services carries an explicit
 * `org_id = $n`: the server is trusted to scope its own reads, and RLS is the
 * second lock, for anything that reaches the database without going through
 * this process. Belt and braces - lose either one and a parish could read
 * another parish's prayers.
 *
 * The service role key must never reach the browser. It is read from the
 * environment and nothing here ever puts it in a response or a log.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the host has configured Supabase, so the gate should run. */
export function authConfigured() {
  return Boolean(URL && SERVICE_KEY);
}

let client = null;

/**
 * Built lazily. Constructing it at import time would mean a missing variable
 * takes the process down before `/healthz` can answer and say why.
 */
export function admin() {
  if (!authConfigured()) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set.');
  }
  if (!client) {
    client = createClient(URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

/**
 * The user behind an access token, or null.
 *
 * Supabase verifies the signature and the expiry; doing it here with a copy of
 * the secret would be a second implementation of something that already exists
 * and can only drift from it.
 *
 * A short cache keeps a burst of requests - opening a month fires one per
 * chosen day - from becoming one round trip each. Tokens are cached for a
 * minute, well inside their lifetime, and the cache is keyed by the token
 * itself so a signed-out token is never reused.
 */
const seen = new Map();
const TTL_MS = 60_000;

export async function userFromToken(token) {
  if (!token) return null;

  const hit = seen.get(token);
  if (hit && hit.until > Date.now()) return hit.user;

  const { data, error } = await admin().auth.getUser(token);
  const user = error || !data?.user ? null : data.user;

  // Cache the misses too, briefly: a scanner hammering one bad token should not
  // cost a round trip per attempt.
  seen.set(token, { user, until: Date.now() + TTL_MS });
  if (seen.size > 500) {
    for (const [key, value] of seen) if (value.until <= Date.now()) seen.delete(key);
  }
  return user;
}

export default { admin, authConfigured, userFromToken };
