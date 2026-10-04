/**
 * The Content-Security-Policy, and specifically `connect-src`.
 *
 * This exists because of a real outage. The policy was written when the client
 * only ever talked to its own origin, and stayed `connect-src 'self'` after
 * sign-in moved to Supabase. The browser then blocked every auth request before
 * it left the page, and `fetch` rejected with "Failed to fetch" - which reads
 * like a dead network and is actually a response header. Nothing was down,
 * nothing logged an error, and the server looked perfectly healthy.
 *
 * A policy that is too tight fails exactly like this: silently, in the browser,
 * with no server-side trace. So it gets a test.
 *
 *   npm run test:server
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { connectSources } from '../src/app.js';

/** Set SUPABASE_URL for one test and always put the environment back. */
function withSupabaseUrl(value, fn) {
  const before = process.env.SUPABASE_URL;
  if (value === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = before;
  }
}

test('the page may always reach its own origin', () => {
  withSupabaseUrl(undefined, () => {
    assert.deepEqual(connectSources(), ["'self'"]);
  });
});

test('a configured Supabase project is allowed, or sign-in cannot work', () => {
  withSupabaseUrl('https://abcdefgh.supabase.co', () => {
    const sources = connectSources();
    assert.ok(sources.includes("'self'"), 'the API is still on its own origin');
    assert.ok(
      sources.includes('https://abcdefgh.supabase.co'),
      'without this the browser blocks every auth request',
    );
  });
});

test('only the origin is listed, never a path', () => {
  // A CSP source is scheme + host + port. A trailing path is not matched the
  // way it reads, so a URL copied with one must not become a source verbatim.
  withSupabaseUrl('https://abcdefgh.supabase.co/auth/v1/', () => {
    assert.deepEqual(connectSources(), ["'self'", 'https://abcdefgh.supabase.co']);
  });
});

test('a malformed SUPABASE_URL is left out rather than breaking the policy', () => {
  // A bad variable should cost sign-in, not the whole page: an exception here
  // would take out every response, including /healthz.
  withSupabaseUrl('not a url', () => {
    assert.deepEqual(connectSources(), ["'self'"]);
  });
});

test('the policy never opens up to everything', () => {
  // The failure mode to avoid if this is ever "fixed" in a hurry.
  withSupabaseUrl('https://abcdefgh.supabase.co', () => {
    assert.equal(connectSources().includes('*'), false);
    assert.equal(connectSources().includes("'unsafe-inline'"), false);
  });
});
