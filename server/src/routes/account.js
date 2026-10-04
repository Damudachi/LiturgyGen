/**
 * Who am I, and which parish am I in.
 *
 * These sit behind the gate but NOT behind the parish requirement: a brand new
 * account has confirmed its email and belongs to nothing yet, and this is the
 * route that gets it out of that state. Requiring a parish here would be a loop
 * - you could not found one without already being in one.
 */

import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { query, withTransaction, DEFAULT_SETTINGS } from '../db/index.js';
import { seedPotfTemplates } from '../db/seed.js';

const router = Router();

// Signed in is enough for everything in this file.
router.use(requireAuth({ requireOrg: false }));

/** A slug from a parish name: lower case, words joined by hyphens. */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * The signed-in account, and its parish if it has one.
 *
 * Never returns anything the caller did not already have: their own email and
 * their own parish. The access token is not echoed back.
 */
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      // Auth is switched off (local development). Say so plainly rather than
      // inventing a user, so the client does not render a half-signed-in state.
      return res.json({ authDisabled: true, user: null, organisation: null });
    }

    const { rows } = await query(
      `SELECT o.id, o.name, o.slug, m.role, m.created_at AS joined_at
         FROM memberships m
         JOIN organizations o ON o.id = m.org_id
        WHERE m.user_id = $1
        ORDER BY m.created_at ASC`,
      [req.user.id],
    );

    res.json({
      authDisabled: false,
      user: {
        id: req.user.id,
        email: req.user.email,
        createdAt: req.user.created_at,
      },
      organisation: rows.length ? rows[0] : null,
      organisations: rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Found a parish, and become its owner.
 *
 * Everything here is one transaction. A parish that exists but whose founder is
 * not a member of it is invisible to the only person who could fix it, and a
 * parish with no settings row renders a blank settings screen - both are states
 * worth never being in, even for the moment between two statements.
 *
 * The membership is written explicitly rather than left to the `claim_new_org`
 * trigger, because the trigger reads `auth.uid()` and this connection is the
 * service role: there is no end-user JWT on it, so `auth.uid()` is null. The
 * server knows which user it is acting for; the trigger does not.
 */
router.post('/organisation', async (req, res, next) => {
  try {
    if (!req.user) return res.status(400).json({ error: 'Authentication is not configured on this server.' });

    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'A parish name is needed, between 2 and 120 characters.' });
    }

    const existing = await query('SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1', [req.user.id]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'This account already belongs to a parish.' });
    }

    const base = slugify(name) || 'parish';

    const organisation = await withTransaction(async (client) => {
      // A slug collides whenever two parishes share a name, which is likely -
      // there is more than one Holy Guardian Angel. Try the plain one, then
      // suffix it. Bounded, so a pathological case fails loudly instead of
      // spinning.
      let slug = base;
      for (let attempt = 1; attempt <= 25; attempt += 1) {
        const taken = await client.query('SELECT 1 FROM organizations WHERE slug = $1', [slug]);
        if (!taken.rows.length) break;
        slug = `${base}-${attempt + 1}`.slice(0, 60);
        if (attempt === 25) throw Object.assign(new Error('Could not find a free name for that parish.'), { status: 409 });
      }

      const created = await client.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
        [name, slug],
      );
      const org = created.rows[0];

      await client.query(
        `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [org.id, req.user.id],
      );

      // The house style, so the settings screen is never blank.
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await client.query(
          `INSERT INTO settings (org_id, key, value) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (org_id, key) DO NOTHING`,
          [org.id, key, JSON.stringify(value)],
        );
      }

      return org;
    });

    // The placeholder prayers, so a new parish is not staring at an empty
    // library. Outside the transaction on purpose: it is a convenience, and a
    // parish that exists with no prayers is recoverable, whereas a parish that
    // failed to exist because its sample data did not is just confusing.
    let seeded = 0;
    try {
      ({ inserted: seeded = 0 } = await seedPotfTemplates({ orgId: organisation.id }));
    } catch (error) {
      console.error('could not seed starter prayers for', organisation.slug, '-', error.message);
    }

    res.status(201).json({ organisation, seededPrayers: seeded });
  } catch (error) {
    next(error);
  }
});

export default router;
