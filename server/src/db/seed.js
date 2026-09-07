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
import { getDb } from './index.js';
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
  return [...POTF_SEEDS, ...seeds];
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

/** The same hash, taken from a row as it currently stands in the database. */
function rowFingerprint(row) {
  return fingerprint({
    title: row.title,
    priestInvitation: row.priest_invitation,
    responseOptions: row.response_options,
    intentions: row.intentions,
    priestConclusion: row.priest_conclusion,
    notes: row.notes,
  });
}

export function seedPotfTemplates({ force = false, log = () => {} } = {}) {
  const db = getDb();
  const allSeeds = collectSeeds(log);

  const findExisting = db.prepare(`
    SELECT id, origin, created_at, updated_at, seed_hash,
           title, priest_invitation, response_options, intentions,
           priest_conclusion, notes
    FROM potf_templates
    WHERE season = @season
      AND week IS @week
      AND day_of_week IS @dayOfWeek
      AND celebration_id IS @celebrationId
      AND fixed_date IS @fixedDate
  `);

  const insert = db.prepare(`
    INSERT INTO potf_templates
      (title, season, week, day_of_week, celebration_id, fixed_date, priest_invitation,
       response_options, intentions, priest_conclusion, notes, origin, is_active, seed_hash)
    VALUES
      (@title, @season, @week, @dayOfWeek, @celebrationId, @fixedDate, @priestInvitation,
       @responseOptions, @intentions, @priestConclusion, @notes, 'seed', 1, @seedHash)
  `);

  const update = db.prepare(`
    UPDATE potf_templates SET
      title = @title,
      fixed_date = @fixedDate,
      priest_invitation = @priestInvitation,
      response_options = @responseOptions,
      intentions = @intentions,
      priest_conclusion = @priestConclusion,
      notes = @notes,
      seed_hash = @seedHash,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  let inserted = 0;
  let refreshed = 0;
  let skipped = 0;

  db.transaction(() => {
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

      const existing = findExisting.get(params);
      if (!existing) {
        insert.run(params);
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
            existing.created_at === existing.updated_at);

      if (force || untouched) {
        update.run({ ...params, id: existing.id });
        refreshed += 1;
      } else {
        skipped += 1;
        log(`  kept edited template #${existing.id} (${signature(seed)})`);
      }
    }
  })();

  return { inserted, refreshed, skipped, total: allSeeds.length };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectRun = entry !== null && entry === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const force = process.argv.includes('--force');
  const result = seedPotfTemplates({ force, log: (line) => console.log(line) });
  console.log(
    `Prayers of the Faithful seeds: ${result.inserted} inserted, ` +
      `${result.refreshed} refreshed, ${result.skipped} left as edited ` +
      `(${result.total} defined).`,
  );
}

export default seedPotfTemplates;
