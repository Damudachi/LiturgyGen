/**
 * HTTP Basic Authentication - the door in front of the whole app.
 *
 * WHY THIS EXISTS
 * ---------------
 * LiturgyGen has nineteen unauthenticated write routes. `DELETE /api/potf/:id`
 * removes a prayer the office transcribed by hand out of a printed book;
 * `DELETE /api/readings/cache` throws away every reading ever fetched, each of
 * which cost a three-minute cooldown to get. On a public URL those get found by
 * a scanner, not by a person, and the result is the office's work gone.
 *
 * There is no user model here and there should not be: nobody logs in, nothing
 * belongs to anybody, and adding accounts to a single-office tool would be
 * inventing a problem. One shared credential in front of everything is the
 * right size of answer.
 *
 * HOW IT IS WIRED
 * ---------------
 * `createApp()` registers this BEFORE any route, so it covers all of them.
 * Two things sit deliberately outside the gate, and both are in `app.js`:
 *
 *   /healthz   a host's health check cannot authenticate. If this is gated the
 *              platform marks the service unhealthy and kills it.
 *   /readyz    same, and it leaks nothing: it answers `{ok, db:'up'|'down'}`.
 *
 * The gate is OFF when BASIC_AUTH_USER and BASIC_AUTH_PASS are unset, so local
 * development and the desktop build are unaffected. Set both on the host and it
 * is ON. This fails open by design - a gate you cannot switch off locally is a
 * gate people work around.
 *
 * Credentials live in the host's settings panel, never in this repository, and
 * are written into the PRIVATE workspace `project/README.md` so the marker can
 * open the app.
 *
 *
 * ====================================================================
 *  WHAT `checkCredentials` HAS TO GET RIGHT
 * ====================================================================
 *
 * The contract, which `server/test/basicAuth.test.js` checks:
 *
 *   1. The header looks like:  Authorization: Basic <base64>
 *      where <base64> is the base64 encoding of `username:password`.
 *      Anything that is missing, is not `Basic`, or is not valid base64 is a
 *      rejection, not a crash.
 *
 *   2. Decode with Buffer.from(encoded, 'base64').toString('utf8'), then split
 *      on the FIRST colon only. A password may legitimately contain colons, so
 *      `split(':')` and taking [1] is wrong - use indexOf and slice.
 *
 *   3. Compare against process.env.BASIC_AUTH_USER / BASIC_AUTH_PASS.
 *
 *   4. Compare in constant time, with node:crypto's timingSafeEqual. A plain
 *      `===` on a string returns as soon as two bytes differ, so how long the
 *      comparison takes tells an attacker how much of the password is right.
 *      timingSafeEqual throws if the two buffers differ in length, so length
 *      has to be equalised or checked first - hashing both sides with sha256
 *      before comparing is the usual trick, because every digest is 32 bytes.
 *
 *   5. Return true or false. Do not send the response from in here; `gate()`
 *      below owns that, so there is one place that decides what a rejection
 *      looks like.
 *
 * Read: MDN "HTTP authentication", RFC 7617, and node:crypto timingSafeEqual.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { unauthorizedPage } from '../views/pages.js';

/**
 * @param {string|undefined} header  the raw Authorization header
 * @returns {boolean} true if it carries the configured username and password
 */
export function checkCredentials(header) {
  if (typeof header !== 'string') return false;

  // RFC 7235: the scheme token is case-insensitive, and exactly one space
  // separates it from the credentials. Some clients send "basic".
  const match = /^basic +(\S+)$/i.exec(header.trim());
  if (!match) return false;
  const encoded = match[1];

  // Buffer.from(..., 'base64') silently DISCARDS characters outside the
  // alphabet, so "!!!not-base64!!!" decodes to plausible-looking bytes instead
  // of failing. Checking the shape first means garbage is rejected as garbage.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return false;

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');

  // Split on the FIRST colon only. The username cannot contain one; the
  // password can, and `decoded.split(':')[1]` would truncate it - which would
  // let the shorter prefix through as if it were the real password.
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) return false;

  // Both halves are compared, and both comparisons always run: `&&` would
  // short-circuit on a wrong username and never time the password, which is
  // its own small signal.
  const userOk = constantTimeEqual(username, expectedUser);
  const passOk = constantTimeEqual(password, expectedPass);
  return userOk && passOk;
}

/**
 * Compare two strings without leaking, in how long it takes, how much of the
 * second one the first got right.
 *
 * `===` on strings returns the moment two bytes differ, so a password that is
 * wrong in its first character is rejected measurably faster than one wrong in
 * its twentieth - repeat that enough times and the password can be guessed a
 * character at a time. timingSafeEqual does not short-circuit, but it throws
 * when the two buffers differ in length, and the length of a password is
 * exactly what we must not reveal. Hashing both sides first solves both
 * problems at once: every sha256 digest is 32 bytes, so the lengths always
 * match, and the digest of a near-miss shares no prefix with the real one.
 */
function constantTimeEqual(actual, expected) {
  const a = createHash('sha256').update(String(actual), 'utf8').digest();
  const b = createHash('sha256').update(String(expected), 'utf8').digest();
  return timingSafeEqual(a, b);
}

/** True when the host has configured a credential, so the gate should run. */
export function gateEnabled() {
  return Boolean(process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS);
}

/**
 * The Express middleware. This part is done; it calls your function.
 *
 * The 401 carries `WWW-Authenticate: Basic realm="..."`, which is what makes a
 * browser show its own login box instead of a blank error page. `charset=UTF-8`
 * tells the browser to encode a non-ASCII password as UTF-8 rather than latin-1.
 */
export default function basicAuth({ realm = 'LiturgyGen' } = {}) {
  return function gate(req, res, next) {
    if (!gateEnabled()) return next();

    let ok = false;
    try {
      ok = checkCredentials(req.headers.authorization);
    } catch (error) {
      // A broken check must DENY, never let everything through. This is the one
      // place in the app that fails closed.
      console.error('basicAuth: credential check failed -', error.message);
      ok = false;
    }

    if (ok) return next();

    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);

    /*
     * Same status, same header, two bodies.
     *
     * The header is what makes the browser show its own prompt, and that is
     * unstyleable - it is browser chrome, not our page. What IS ours is what
     * sits behind it when the prompt is cancelled or dismissed. A person who
     * presses Escape used to land on a blank page holding
     * {"error":"Authentication required."}, which reads as a crash.
     *
     * So: a page for anything that asked for HTML, and the JSON for everything
     * else. The order of `res.format` keys matters - the first is the default
     * for a client that expresses no preference, and `fetch` sends
     * an Accept header that matches anything, so JSON has to come first or the
     * client would be handed a web page where it expects an error object.
     *
     * No detail in either body. "Wrong password" and "no such user" are the
     * same answer here, because there is only ever one account.
     */
    res.status(401).format({
      'application/json': () => res.json({ error: 'Authentication required.' }),
      'text/html': () => res.type('html').send(unauthorizedPage()),
      default: () => res.json({ error: 'Authentication required.' }),
    });
    return undefined;
  };
}
