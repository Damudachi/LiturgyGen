/**
 * The four requests the client makes the moment somebody signs in.
 *
 * This exists because of a real outage. Adding multi-parish scoping turned
 * `getSettings()` into `getSettings(req.orgId)` inside a handler whose parameter
 * was still named `_req`, so `GET /api/settings` threw `ReferenceError: req is
 * not defined` on every call. In production the error handler turns a 500 into
 * "Something went wrong on the server.", the client turns that into "LiturgyGen's
 * server is not running", and the advice on screen is to start a server that was
 * already running. It shipped twice.
 *
 * Every other test in this suite drives a service function directly, which is
 * why none of them noticed: the bug was in the wiring between the route and the
 * service, and nothing crossed that line. So this one goes over HTTP, and it
 * asserts the status of each boot call rather than the shape of its body - a
 * handler that throws cannot return 200, whatever else changes about the JSON.
 *
 *   npm run test:server
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { makeTestDb, TEST_ORG_ID } from './helpers/pgMem.js';
import { useTestPool } from '../src/db/index.js';

const { pool } = await makeTestDb();
useTestPool(pool);

// Accounts off, one parish pinned: the shape a local checkout runs in, and the
// only way to reach these routes without minting a Supabase token.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.LITURGYGEN_DEV_ORG_ID = TEST_ORG_ID;

const { default: createApp } = await import('../src/app.js');
const { seedPotfTemplates } = await import('../src/db/seed.js');
await seedPotfTemplates({ orgId: TEST_ORG_ID });

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

/* The exact four, in the order client/src/App.jsx asks for them. */
const BOOT_CALLS = ['/api/health', '/api/settings', '/api/potf/meta', '/api/potf'];

for (const route of BOOT_CALLS) {
  test(`${route} answers the client's boot request`, async () => {
    const response = await fetch(base + route);
    const body = await response.text();
    // The body is in the message because a 500 here carries the real reason,
    // and reading it off the assertion is the whole difference between
    // "something is wrong" and "req is not defined".
    assert.equal(response.status, 200, `${route} -> ${response.status}: ${body.slice(0, 300)}`);
    assert.doesNotMatch(body, /is not defined|Something went wrong/i, `${route} returned an error body`);
  });
}

test('settings arrive with the defaults the client needs to render', async () => {
  const payload = await (await fetch(`${base}/api/settings`)).json();
  assert.ok(payload.settings, 'settings');
  assert.ok(payload.defaults, 'defaults');
  assert.ok(payload.style, 'style');
});

/*
 * The front door, and the one script on it.
 *
 * Supabase email links land on `/` with the session or the error in the URL
 * fragment, which the server never sees. `/auth-forward.js` is what carries it
 * to `/app`; if the page stops loading it, or the route stops answering, a
 * valid confirmation link silently does nothing and nobody finds out from a
 * log. Both are outside the gate on purpose - the visitor is not signed in yet.
 */
test('the landing page loads the fragment forwarder', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<script src="\/auth-forward\.js"><\/script>/);
});

test('the forwarder is served as javascript and hands the fragment to /app', async () => {
  const response = await fetch(`${base}/auth-forward.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /javascript/);
  const body = await response.text();
  assert.match(body, /location\.replace\('\/app'/);
  assert.match(body, /access_token/);
});
