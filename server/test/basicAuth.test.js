/**
 * The contract for the Basic Auth gate.
 *
 * These tests SKIP while `checkCredentials` is still the stub, so CI stays
 * green. Delete the `checkCredentials.notImplemented = true` line in
 * src/middleware/basicAuth.js and they turn on by themselves - that is your
 * red-green loop for writing it.
 *
 *   npm run test:server
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import basicAuth, { checkCredentials, gateEnabled } from '../src/middleware/basicAuth.js';

const PENDING = checkCredentials.notImplemented
  ? 'checkCredentials is not written yet - see the spec in src/middleware/basicAuth.js'
  : false;

const USER = 'marker';
const PASS = 'a-long-random-string';
const header = (u, p) => `Basic ${Buffer.from(`${u}:${p}`, 'utf8').toString('base64')}`;

/** Set the credentials for one test and always put the environment back. */
function withCredentials(fn) {
  const before = { u: process.env.BASIC_AUTH_USER, p: process.env.BASIC_AUTH_PASS };
  process.env.BASIC_AUTH_USER = USER;
  process.env.BASIC_AUTH_PASS = PASS;
  try {
    return fn();
  } finally {
    if (before.u === undefined) delete process.env.BASIC_AUTH_USER;
    else process.env.BASIC_AUTH_USER = before.u;
    if (before.p === undefined) delete process.env.BASIC_AUTH_PASS;
    else process.env.BASIC_AUTH_PASS = before.p;
  }
}

/* ------------------------------------------------------------------ *
 * The gate's on/off switch - this part is already written, so it runs.
 * ------------------------------------------------------------------ */

test('the gate is off when no credential is configured', () => {
  const before = { u: process.env.BASIC_AUTH_USER, p: process.env.BASIC_AUTH_PASS };
  delete process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_PASS;
  try {
    assert.equal(gateEnabled(), false);
    let called = false;
    basicAuth()({ headers: {} }, null, () => { called = true; });
    assert.equal(called, true, 'an unconfigured gate must call next()');
  } finally {
    if (before.u !== undefined) process.env.BASIC_AUTH_USER = before.u;
    if (before.p !== undefined) process.env.BASIC_AUTH_PASS = before.p;
  }
});

test('the gate is on once both variables are set', () => {
  withCredentials(() => assert.equal(gateEnabled(), true));
});

test('a broken credential check denies rather than letting everything through', () => {
  // The stub throws. Whatever you replace it with, a thrown error must still
  // produce a 401 - this is the one place the app has to fail closed.
  withCredentials(() => {
    const sent = {};
    const res = {
      setHeader: (k, v) => { sent[k] = v; },
      status(code) { sent.code = code; return this; },
      json(body) { sent.body = body; return this; },
    };
    let nexted = false;
    basicAuth()({ headers: { authorization: 'Basic ' + Buffer.from('x:y').toString('base64') } }, res, () => { nexted = true; });
    assert.equal(nexted, false, 'a failing check must not call next()');
    assert.equal(sent.code, 401);
  });
});

/* ------------------------------------------------------------------ *
 * The part you are writing.
 * ------------------------------------------------------------------ */

test('accepts the configured username and password', { skip: PENDING }, () => {
  withCredentials(() => assert.equal(checkCredentials(header(USER, PASS)), true));
});

test('rejects a wrong password', { skip: PENDING }, () => {
  withCredentials(() => assert.equal(checkCredentials(header(USER, 'wrong')), false));
});

test('rejects a wrong username', { skip: PENDING }, () => {
  withCredentials(() => assert.equal(checkCredentials(header('someone-else', PASS)), false));
});

test('rejects a password that is a prefix of the real one', { skip: PENDING }, () => {
  // Catches a comparison that stops at the first difference in length.
  withCredentials(() => assert.equal(checkCredentials(header(USER, PASS.slice(0, -1))), false));
});

test('rejects a password that extends the real one', { skip: PENDING }, () => {
  withCredentials(() => assert.equal(checkCredentials(header(USER, `${PASS}x`)), false));
});

test('keeps a colon inside the password', { skip: PENDING }, () => {
  // RFC 7617: the username cannot contain a colon, the password can. Splitting
  // on every colon and taking [1] truncates this password and lets a shorter
  // one through.
  const tricky = 'pass:with:colons';
  const before = process.env.BASIC_AUTH_PASS;
  process.env.BASIC_AUTH_USER = USER;
  process.env.BASIC_AUTH_PASS = tricky;
  try {
    assert.equal(checkCredentials(header(USER, tricky)), true);
    assert.equal(checkCredentials(header(USER, 'pass')), false);
  } finally {
    process.env.BASIC_AUTH_PASS = before;
  }
});

test('rejects a missing, malformed or non-Basic header without throwing', { skip: PENDING }, () => {
  withCredentials(() => {
    for (const bad of [
      undefined,
      '',
      'Basic',
      'Basic ',
      'Bearer some.jwt.token',
      'Basic !!!not-base64!!!',
      `Basic ${Buffer.from('no-colon-at-all', 'utf8').toString('base64')}`,
      header('', ''),
    ]) {
      assert.equal(checkCredentials(bad), false, `should reject: ${String(bad)}`);
    }
  });
});

test('is not case sensitive about the word Basic', { skip: PENDING }, () => {
  // RFC 7235 says the scheme token is case-insensitive. Some clients send
  // "basic". Rejecting those is a bug you will spend an hour on.
  withCredentials(() => {
    assert.equal(checkCredentials(header(USER, PASS).replace('Basic', 'basic')), true);
  });
});
