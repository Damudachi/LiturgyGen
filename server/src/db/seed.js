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

export async function seedPotfTemplates({ force = false, log = () => {} } = {}) {
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
    WHERE season = $1
      AND (week           = $2 OR (week           IS NULL AND $2::int  IS NULL))
      AND (day_of_week    = $3 OR (day_of_week    IS NULL AND $3::text IS NULL))
      AND (celebration_id = $4 OR (celebration_id IS NULL AND $4::text IS NULL))
      AND (fixed_date     = $5 OR (fixed_date     IS NULL AND $5::text IS NULL))
  `;

  const INSERT = `
    INSERT INTO potf_templates
      (title, season, week, day_of_week, celebration_id, fixed_date, priest_invitation,
       response_options, intentions, priest_conclusion, notes, origin, is_active, seed_hash,
       is_placeholder)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, 'seed', TRUE, $12, $13)
  `;

  const UPDATE = `
    UPDATE potf_templates SET
      title = $1, fixed_date = $2, priest_invitation = $3,
      response_options = $4::jsonb, intentions = $5::jsonb, priest_conclusion = $6,
      notes = $7, seed_hash = $8, is_placeholder = $9, updated_at = now()
    WHERE id = $10
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
        params.season, params.week, params.dayOfWeek, params.celebrationId, params.fixedDate,
      ]);
      const existing = found.rows[0];

      if (!existing) {
        await client.query(INSERT, [
          params.title, params.season, params.week, params.dayOfWeek, params.celebrationId,
          params.fixedDate, params.priestInvitation, params.responseOptions, params.intentions,
          params.priestConclusion, params.notes, params.seedHash, params.isPlaceholder,
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
          params.isPlaceholder, existing.id,
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

if (isDirectRun) {
  const force = process.argv.includes('--force');
  const result = await seedPotfTemplates({ force, log: (line) => console.log(line) });
  console.log(
    `Prayers of the Faithful seeds: ${result.inserted} inserted, ` +
      `${result.refreshed} refreshed, ${result.skipped} left as edited ` +
      `(${result.total} defined).`,
  );
}

export default seedPotfTemplates;
