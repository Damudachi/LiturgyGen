/**
 * Idempotent seeding. Re-running never duplicates a template and never
 * overwrites text the office has edited.
 *
 * "Untouched" is decided by fingerprint, not by timestamps: the seeder stores a
 * hash of the text it wrote, and a row whose current text still hashes to that
 * value has not been edited since. Timestamps cannot answer this, because
 * refreshing a row bumps updated_at - which made every seed row look edited from
 * the second run onwards, so later corrections never reached the office.
 *
 *   npm run seed            insert missing seeds, refresh untouched ones
 *   npm run seed -- --force refresh every seed row, discarding edits to them
 */

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from './index.js';
import { POTF_SEEDS } from './seeds/potf.seed.js';
import { ORILLO_DATA_DIR, loadOrilloSeeds } from './seeds/orillo.seed.js';

// Transcriptions from the office's own books come after the placeholders, so a
// transcribed day overwrites a placeholder that occupies the same slot.
//
// The transcriptions live outside the repository - see orillo.seed.js - so a
// checkout without them seeds the placeholders and says which sections it could
// not find, rather than looking like a complete seed that quietly is not.
function collectSeeds(log) {
  const { seeds, missing } = loadOrilloSeeds();
  if (missing.length) {
    log(`  no Orillo transcriptions for: ${missing.join(', ')}`);
    log(`  (expected in ${ORILLO_DATA_DIR} - placeholders will be used instead)`);
  }
  return [
    ...POTF_SEEDS.map((seed) => ({ ...seed, placeholder: true })),
    ...seeds.map((seed) => ({ ...seed, placeholder: false })),
  ];
}

function signature(seed) {
  return [seed.season, seed.week ?? '', seed.dayOfWeek ?? '', seed.celebrationId ?? '', seed.fixedDate ?? ''].join('|');
}

/** Hash of the fields the seeder writes, so an edit to any of them shows up. */
function fingerprint({ title, priestInvitation, responseOptions, intentions, priestConclusion, notes }) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        title,
        priestInvitation,
        responseOptions,
        intentions,
        priestConclusion,
        notes ?? null,
      ]),
    )
    .digest('hex');
}

/**
 * The same hash, taken from a row as it currently stands in the database.
 *
 * `response_options` and `intentions` are JSONB, so the driver returns arrays
 * where SQLite returned the JSON text. The seed side of the comparison is
 * JSON.stringify'd, so these are stringified to match - otherwise every seeded
 * row would look edited on the first run after the migration and the seeder
 * would refuse to refresh any of them.
 */
function rowFingerprint(row) {
  return fingerprint({
    title: row.title,
    priestInvitation: row.priest_invitation,
    responseOptions: JSON.stringify(row.response_options ?? []),
    intentions: JSON.stringify(row.intentions ?? []),
    priestConclusion: row.priest_conclusion,
    notes: row.notes,
  });
}


/**
 * Copy one parish's prayer library into another, inside the database.
 *
 * WHY THIS EXISTS
 * ---------------
 * `collectSeeds()` reads the office's transcriptions from `server/data/orillo`,
 * which is git-ignored and therefore exists on the office's machines and
 * nowhere else. A deployed server has no copy, so founding a parish on the host
 * seeded the placeholder set and nothing else - which is how two live parishes
 * ended up holding 19 placeholders apiece and not one real prayer.
 *
 * The obvious fix is to commit the transcriptions. That is the one thing
 * `seeds/orillo.seed.js` says must never happen: the books are under copyright
 * and the repository is public. So instead the prayers are loaded into ONE
 * parish on the host - once, by somebody running the command below from a
 * machine that has the files - and every parish founded afterwards is filled
 * from that one by `INSERT ... SELECT`, entirely inside the database.
 *
 * Set `LITURGYGEN_SEED_SOURCE_ORG_ID` on the host to the parish to copy from.
 * Unset, nothing changes and seeding falls back to the files as before.
 *
 * `origin` is rewritten to 'seed' on the copies so the seeder still recognises
 * them as its own and leaves an edited row alone; `id`, `org_id` and the
 * timestamps are not copied, because they belong to the new parish.
 */
export async function cloneLibrary(targetOrgId, sourceOrgId) {
  if (!targetOrgId || !sourceOrgId || targetOrgId === sourceOrgId) return { copied: 0 };

  const { rows } = await query(
    `INSERT INTO potf_templates
       (org_id, title, season, week, day_of_week, celebration_id, fixed_date,
        priest_invitation, response_options, intentions, priest_conclusion, notes,
        origin, seed_hash, is_placeholder, is_active)
     SELECT $1, title, season, week, day_of_week, celebration_id, fixed_date,
            priest_invitation, response_options, intentions, priest_conclusion, notes,
            'seed', seed_hash, is_placeholder, is_active
       FROM potf_templates
      WHERE org_id = $2
     RETURNING id`,
    [targetOrgId, sourceOrgId],
  );
  return { copied: rows.length };
}

/**
 * Empty a parish's seeded prayers, leaving anything somebody edited or typed.
 *
 * Used before a re-clone, so running the backfill twice does not double every
 * prayer in the library. `origin <> 'seed'` is the guard: a prayer the office
 * typed in or imported from their own book is theirs and is never touched.
 */
export async function clearSeeded(orgId) {
  const { rows } = await query(
    `DELETE FROM potf_templates WHERE org_id = $1 AND origin = 'seed' RETURNING id`,
    [orgId],
  );
  return { removed: rows.length };
}

export async function seedPotfTemplates({ orgId = null, force = false, log = () => {} } = {}) {
  // Seeding is per-parish now. Without an org there is nowhere to put the
  // starter prayers, and seeding them into every parish at once would be the
  // only other reading of a missing one.
  if (!orgId) return { inserted: 0, refreshed: 0, skipped: 0, total: 0 };

  /*
   * No transcriptions on this machine - which is every deployed host, since
   * `data/orillo` is git-ignored. Copy them from the parish named by
   * LITURGYGEN_SEED_SOURCE_ORG_ID instead of seeding placeholders alone.
   * See cloneLibrary() above for why the files are not simply committed.
   */
  const sourceOrgId = process.env.LITURGYGEN_SEED_SOURCE_ORG_ID;
  if (sourceOrgId && sourceOrgId !== orgId && !loadOrilloSeeds().seeds.length) {
    const { copied } = await cloneLibrary(orgId, sourceOrgId);
    if (copied) {
      log(`  copied ${copied} prayers from the seed parish`);
      return { inserted: copied, refreshed: 0, skipped: 0, total: copied };
    }
    log('  seed parish holds no prayers; falling back to the placeholders');
  }
  const allSeeds = collectSeeds(log);

  /*
   * `week IS @week` was SQLite's null-safe comparison, and it is doing real
   * work: most of these keys are NULL most of the time, and plain `=` is never
   * true when either side is NULL. Without a null-safe match every seeded row
   * would look new on every run and duplicate itself.
   *
   * PostgreSQL spells this `IS NOT DISTINCT FROM`. It is written out longhand
   * instead because pg-mem, which the tests run against, cannot parse that
   * operator - and `(a = b OR (a IS NULL AND b IS NULL))` is plain SQL that
   * both understand and that says the same thing. The casts are there because
   * a bare parameter has no type for `IS NULL` to work with.
   */
  const FIND_EXISTING = `
    SELECT id, origin, created_at, updated_at, seed_hash,
           title, priest_invitation, response_options, intentions,
           priest_conclusion, notes
    FROM potf_templates
    WHERE org_id = $6
      AND season = $1
      AND (week           = $2 OR (week           IS NULL AND $2::int  IS NULL))
      AND (day_of_week    = $3 OR (day_of_week    IS NULL AND $3::text IS NULL))
      AND (celebration_id = $4 OR (celebration_id IS NULL AND $4::text IS NULL))
      AND (fixed_date     = $5 OR (fixed_date     IS NULL AND $5::text IS NULL))
  `;

  const INSERT = `
    INSERT INTO potf_templates
      (org_id, title, season, week, day_of_week, celebration_id, fixed_date, priest_invitation,
       response_options, intentions, priest_conclusion, notes, origin, is_active, seed_hash,
       is_placeholder)
    -- org_id is $14 (appended to the params array) so the existing $1..$13
    -- keep their meaning. Renumbering them instead shifted every column by
    -- one and fed the title into a JSONB cast.
    VALUES ($14, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, 'seed', TRUE, $12, $13)
  `;

  const UPDATE = `
    UPDATE potf_templates SET
      title = $1, fixed_date = $2, priest_invitation = $3,
      response_options = $4::jsonb, intentions = $5::jsonb, priest_conclusion = $6,
      notes = $7, seed_hash = $8, is_placeholder = $9, updated_at = now()
    WHERE org_id = $11 AND id = $10
  `;

  let inserted = 0;
  let refreshed = 0;
  let skipped = 0;

  /*
   * One transaction for the whole seed. This is the place in the codebase where
   * a real transaction earns its keep: a half-seeded template table is worse
   * than an unseeded one, because the office would see some prayers resolve and
   * others silently not.
   */
  await withTransaction(async (client) => {
    for (const seed of allSeeds) {
      const params = {
        title: seed.title,
        season: seed.season,
        week: seed.week ?? null,
        dayOfWeek: seed.dayOfWeek ?? null,
        celebrationId: seed.celebrationId ?? null,
        fixedDate: seed.fixedDate ?? null,
        priestInvitation: seed.priestInvitation,
        responseOptions: JSON.stringify(seed.responseOptions),
        intentions: JSON.stringify(seed.intentions),
        priestConclusion: seed.priestConclusion,
        notes: seed.notes ?? null,
      };
      params.seedHash = fingerprint(params);
      // Outside the fingerprint on purpose: it describes where the text came
      // from, not the text, and changing it must not make a row look edited.
      // A placeholder the office has rewritten is skipped below and keeps the
      // flag its edit cleared - it is their prayer now.
      params.isPlaceholder = Boolean(seed.placeholder);

      const found = await client.query(FIND_EXISTING, [
        params.season, params.week, params.dayOfWeek, params.celebrationId, params.fixedDate, orgId,
      ]);
      const existing = found.rows[0];

      if (!existing) {
        await client.query(INSERT, [
          params.title, params.season, params.week, params.dayOfWeek, params.celebrationId,
          params.fixedDate, params.priestInvitation, params.responseOptions, params.intentions,
          params.priestConclusion, params.notes, params.seedHash, params.isPlaceholder, orgId,
        ]);
        inserted += 1;
        continue;
      }

      const untouched =
        existing.origin === 'seed' &&
        (existing.seed_hash
          ? rowFingerprint(existing) === existing.seed_hash
          : // Databases predating the fingerprint column: fall back to comparing
            // against the seed itself. A row still holding the seeded text is
            // untouched; anything else is treated as edited and left alone.
            rowFingerprint(existing) === params.seedHash ||
            String(existing.created_at) === String(existing.updated_at));

      if (force || untouched) {
        await client.query(UPDATE, [
          params.title, params.fixedDate, params.priestInvitation, params.responseOptions,
          params.intentions, params.priestConclusion, params.notes, params.seedHash,
          params.isPlaceholder, existing.id, orgId,
        ]);
        refreshed += 1;
      } else {
        skipped += 1;
        log(`  kept edited template #${existing.id} (${signature(seed)})`);
      }
    }
  });

  return { inserted, refreshed, skipped, total: allSeeds.length };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectRun = entry !== null && entry === path.resolve(fileURLToPath(import.meta.url));

/*
 * The command line.
 *
 * Seeding is per-parish, so this needs an --org. It used to call
 * seedPotfTemplates() with no arguments, which hit the `if (!orgId) return`
 * guard at the top and printed "0 inserted, 0 refreshed, 0 left as edited
 * (0 defined)" - a silent no-op that read like a finished seed. Anyone running
 * `npm run seed` to put the office's transcriptions into a new parish got that
 * line and no prayers.
 *
 *   npm run seed -- --list                 which parishes exist
 *   npm run seed -- --org <uuid>           seed that parish
 *   npm run seed -- --org <uuid> --force   overwrite rows somebody has edited
 *
 * Point DATABASE_URL at whichever database you mean. The transcriptions are
 * read from server/data/orillo, which is gitignored and exists only on a
 * machine that has the office's copies - so this is the way to get them into a
 * deployed database without putting the book in the repository.
 */
function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

if (isDirectRun) {
  if (process.argv.includes('--list')) {
    const { rows } = await query('SELECT id, name, slug FROM organizations ORDER BY created_at');
    if (!rows.length) {
      console.log('No parishes yet. Sign in and found one first.');
    } else {
      console.log('Parishes:');
      for (const row of rows) console.log(`  ${row.id}  ${row.name} (${row.slug})`);
    }
    process.exit(0);
  }

  /*
   * Fill every other parish from one that already holds the real prayers,
   * database to database. This is the command to run once after loading the
   * transcriptions into the first parish, and it is what makes the prayers
   * appear in accounts that already exist.
   *
   *   npm run seed -- --clone-to-all --source <uuid>
   *
   * Prayers the office typed in or imported are never touched: only rows with
   * origin = 'seed' are replaced. Safe to run twice.
   */
  if (process.argv.includes('--clone-to-all')) {
    const sourceOrgId = flagValue('--source');
    if (!sourceOrgId) {
      console.error('Which parish holds the prayers? Pass --source <uuid>.');
      process.exit(1);
    }
    const { rows: source } = await query(
      `SELECT name, (SELECT count(*) FROM potf_templates t WHERE t.org_id = o.id) AS prayers
         FROM organizations o WHERE id = $1`,
      [sourceOrgId],
    );
    if (!source.length) {
      console.error(`No parish with id ${sourceOrgId}.`);
      process.exit(1);
    }
    console.log(`Source: ${source[0].name} (${source[0].prayers} prayers).`);

    const { rows: targets } = await query(
      'SELECT id, name FROM organizations WHERE id <> $1 ORDER BY created_at',
      [sourceOrgId],
    );
    if (!targets.length) console.log('No other parishes to fill.');
    for (const target of targets) {
      const { removed } = await clearSeeded(target.id);
      const { copied } = await cloneLibrary(target.id, sourceOrgId);
      console.log(`  ${target.name}: replaced ${removed} seeded, copied ${copied}.`);
    }
    console.log('');
    console.log(
      `For parishes founded from now on, set LITURGYGEN_SEED_SOURCE_ORG_ID=${sourceOrgId}`,
    );
    console.log("in the host's environment, so a new account is filled from that parish too.");
    process.exit(0);
  }

  const orgId = flagValue('--org');
  if (!orgId) {
    console.error('Which parish? Pass --org <uuid>, or --list to see them.');
    console.error('  npm run seed -- --list');
    console.error('  npm run seed -- --org <uuid>                     seed from server/data/orillo');
    console.error('  npm run seed -- --clone-to-all --source <uuid>   fill every other parish from that one');
    process.exit(1);
  }

  const { rows } = await query('SELECT name FROM organizations WHERE id = $1', [orgId]);
  if (!rows.length) {
    console.error(`No parish with id ${orgId}. Run with --list to see them.`);
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const result = await seedPotfTemplates({ orgId, force, log: (line) => console.log(line) });
  console.log(
    `${rows[0].name}: ${result.inserted} inserted, ${result.refreshed} refreshed, ` +
      `${result.skipped} left as edited (${result.total} defined).`,
  );
  if (!result.total) {
    console.error(
      'Nothing was defined, which means server/data/orillo has no sections in it. ' +
        'The transcriptions are not in the repository. Copy the data/orillo directory from the office machine into place.',
    );
    process.exit(1);
  }
  process.exit(0);
}

export default seedPotfTemplates;
