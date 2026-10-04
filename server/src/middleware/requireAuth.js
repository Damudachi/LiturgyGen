/**
 * The door, now that LiturgyGen serves more than one parish.
 *
 * WHAT REPLACED WHAT
 * ------------------
 * This replaced `basicAuth.js`, the single shared password. That was the right
 * size of answer while the app served one office: nobody logged in, nothing
 * belonged to anybody. It stopped being the right answer the moment a second
 * parish could sign up, because a shared password cannot tell you WHICH parish
 * is asking - and every query now needs to know.
 *
 * So the gate does two jobs rather than one:
 *
 *   1. Is this a real, unexpired Supabase session?   -> req.user
 *   2. Which parish is it acting for?                -> req.orgId
 *
 * Without the second, a signed-in user from one parish could read another's
 * prayers simply by asking. `req.orgId` is derived from the user's membership
 * rows on the server; it is NEVER taken from the request, because anything the
 * browser sends is something the browser can change.
 *
 * DEFENCE IN DEPTH
 * ----------------
 * Row Level Security is on for every table and would also stop a cross-parish
 * read. This middleware is the first lock, not the only one. The server holds
 * the service role key, which bypasses RLS, so if the scoping here were the
 * only thing standing between two parishes, a single forgotten `WHERE org_id`
 * would be a leak. It is not: see `server/db/schema.sql`.
 *
 * OUTSIDE THE GATE
 * ----------------
 * `/healthz` and `/readyz` (a host's health check cannot sign in) and the
 * landing page at `/`, all registered before this in `app.js`. Also the auth
 * routes themselves - signing up is necessarily something you do while signed
 * out.
 */

import { query } from '../db/index.js';
import { authConfigured, userFromToken } from '../lib/supabase.js';
import { unauthorizedPage } from '../views/pages.js';

export { authConfigured };

/** The bearer token on a request, or null. The scheme is case-insensitive. */
export function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^bearer +(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * The parish this user acts for.
 *
 * One membership is the ordinary case and needs no choosing. Somebody in two
 * parishes gets the one they joined first, which is stable, rather than
 * whichever the database felt like returning. Picking a different one is a
 * feature that does not exist yet; when it does, it belongs here, validated
 * against the same membership table rather than trusted from a header.
 */
export async function resolveOrgId(userId) {
  const { rows } = await query(
    `SELECT org_id
       FROM memberships
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId],
  );
  return rows.length ? rows[0].org_id : null;
}

/**
 * @param {{ requireOrg?: boolean }} options
 *   requireOrg false lets a signed-in user through without a parish yet, which
 *   the account routes need - that is exactly the state somebody is in between
 *   confirming their email and founding their parish.
 */
export default function requireAuth({ requireOrg = true } = {}) {
  return async function gate(req, res, next) {
    // Unconfigured means local development and the desktop build, where there
    // is no Supabase project to sign in to. Fails OPEN here on purpose, the
    // same way the old gate did: a lock you cannot switch off locally is a lock
    // people work around. On a host both variables are set and it is on.
    if (!authConfigured()) {
      req.user = null;
      req.orgId = process.env.LITURGYGEN_DEV_ORG_ID || null;
      return next();
    }

    try {
      const user = await userFromToken(bearerToken(req.headers.authorization));
      if (!user) {
        /*
         * Two bodies, one status. The client's `fetch` sends an Accept header
         * that matches anything, which lands on `default` - so JSON stays the
         * answer for the app itself, and an error handler never has to parse
         * HTML. A person who opens an /api URL in the address bar asked for
         * text/html and gets a page instead of a line of JSON on white.
         *
         * JSON is listed first because `res.format` uses the first key as the
         * default for a client expressing no preference.
         */
        return res.status(401).format({
          'application/json': () => res.json({ error: 'Sign in to continue.', code: 'NOT_SIGNED_IN' }),
          'text/html': () => res.type('html').send(unauthorizedPage()),
          default: () => res.json({ error: 'Sign in to continue.', code: 'NOT_SIGNED_IN' }),
        });
      }

      req.user = user;
      req.orgId = await resolveOrgId(user.id);

      if (requireOrg && !req.orgId) {
        // Signed in, but not in a parish yet. A distinct code so the client can
        // send them to "create or join a parish" rather than back to sign-in,
        // which would be an infinite loop for a brand new account.
        return res.status(403).json({
          error: 'Your account is not part of a parish yet.',
          code: 'NO_ORGANISATION',
        });
      }

      return next();
    } catch (error) {
      // A failure to CHECK is not permission to pass. This is the one place the
      // app has to fail closed.
      console.error('auth gate failed -', error.message);
      return res.status(503).json({ error: 'Could not verify your session. Try again.' });
    }
  };
}
