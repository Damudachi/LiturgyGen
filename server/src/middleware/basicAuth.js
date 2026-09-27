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
 *  TODO(you): write `checkCredentials`. The rest of this file is done.
 * ====================================================================
 *
 * The spec, which `server/test/basicAuth.test.js` checks:
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

// import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * @param {string|undefined} header  the raw Authorization header
 * @returns {boolean} true if it carries the configured username and password
 */
export function checkCredentials(header) {
  // TODO(you): replace this line with the implementation described above.
  throw new Error('checkCredentials is not implemented yet - see the spec in this file.');
}

/** Set while `checkCredentials` is still the stub, so the tests skip rather
 *  than fail and CI stays green until you have written it. Delete this line
 *  when you implement the function - the tests turn on by themselves. */
checkCredentials.notImplemented = true;

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
      // An unimplemented or broken check must DENY, never let everything
      // through. This is the one place in the app that fails closed.
      console.error('basicAuth: credential check failed -', error.message);
      ok = false;
    }

    if (ok) return next();

    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    // No detail in the body. "Wrong password" and "no such user" are the same
    // answer here, because there is only ever one account.
    return res.status(401).json({ error: 'Authentication required.' });
  };
}
