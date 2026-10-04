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

/**
 * Enough of an Express response to drive the gate.
 *
 * `format` is modelled rather than stubbed away, because the gate now sends
 * two different bodies through it. Express picks the handler whose key best
 * matches the request's Accept header and falls back to `default`; this does
 * the same, crudely - an exact match on the type, otherwise `default`, which
 * is all the branching the gate actually asks of it.
 */
function fakeRes(accept = null) {
  const sent = {};
  const res = {
    sent,
    setHeader: (k, v) => { sent[k] = v; },
    status(code) { sent.code = code; return this; },
    type(t) { sent.type = t; return this; },
    json(body) { sent.body = body; sent.type = sent.type || 'json'; return this; },
    send(body) { sent.body = body; return this; },
    format(map) {
      const handler = (accept && map[accept]) || map.default;
      sent.chose = accept && map[accept] ? accept : 'default';
      return handler();
    },
  };
  return res;
}

test('a broken credential check denies rather than letting everything through', () => {
  // A thrown error must still produce a 401 - this is the one place the app
  // has to fail closed.
  withCredentials(() => {
    const res = fakeRes();
    let nexted = false;
    basicAuth()({ headers: { authorization: 'Basic ' + Buffer.from('x:y').toString('base64') } }, res, () => { nexted = true; });
    assert.equal(nexted, false, 'a failing check must not call next()');
    assert.equal(res.sent.code, 401);
  });
});

test('the 401 always carries WWW-Authenticate, whichever body it sends', () => {
  // This header, not the body, is what makes a browser show its own prompt.
  // Lose it and the gate silently stops being usable by a person.
  for (const accept of [null, 'text/html', 'application/json']) {
    withCredentials(() => {
      const res = fakeRes(accept);
      basicAuth()({ headers: {} }, res, () => assert.fail('must not call next()'));
      assert.equal(res.sent.code, 401);
      assert.match(
        res.sent['WWW-Authenticate'],
        /^Basic realm="LiturgyGen", charset="UTF-8"$/,
        `missing or malformed for Accept: ${String(accept)}`,
      );
    });
  }
});

test('a browser gets a page, so a cancelled prompt is not raw JSON', () => {
  withCredentials(() => {
    const res = fakeRes('text/html');
    basicAuth()({ headers: {} }, res, () => assert.fail('must not call next()'));
    assert.equal(res.sent.type, 'html');
    assert.equal(typeof res.sent.body, 'string');
    assert.match(res.sent.body, /<!doctype html>/i);
    // It must not leak the credential it is guarding, nor name a username.
    assert.equal(res.sent.body.includes(PASS), false, 'the page must not contain the password');
  });
});

test('an API client still gets JSON, not a web page', () => {
  // `fetch` sends an Accept header that matches anything, which lands on
  // `default`. That has to stay JSON or every client-side error handler in the
  // app starts trying to parse HTML.
  for (const accept of [null, 'application/json']) {
    withCredentials(() => {
      const res = fakeRes(accept);
      basicAuth()({ headers: {} }, res, () => assert.fail('must not call next()'));
      assert.deepEqual(res.sent.body, { error: 'Authentication required.' });
    });
  }
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
