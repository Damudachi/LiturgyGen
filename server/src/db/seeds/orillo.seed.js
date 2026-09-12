/**
 * Prayers of the Faithful from the office's own copies of
 *
 *   General Intercessions for Weekday Masses
 *   Fr. Albert Orillo, ST PAULS Philippines
 *   - (Proper of Seasons, Solemnities, and Feasts)   [blue]
 *   - (Ordinary Time)                                [green]
 *
 * THE PRAYER TEXT IS NOT IN THIS REPOSITORY, AND MUST NOT BE ADDED TO IT.
 *
 * The book is under copyright and our transcription is for office use only, so
 * the text lives outside version control in
 *
 *   server/data/orillo/*.json     (gitignored, alongside the sqlite database)
 *
 * one file per section of the book - advent, christmas, lent, easter,
 * solemnities - each shaped as { source, section, notice, prayers: [...] }.
 * This module is only the loader; the repository carries the code, never the
 * book. A checkout without those files still runs: seeding simply reports that
 * the transcriptions are absent and seeds the placeholders alone.
 *
 * To set up a machine, copy the office's `data/orillo` directory into place, or
 * type the pages in through the Template Manager, which writes straight to the
 * database.
 *
 * These are the prayers the office actually prays, so they take precedence over
 * the placeholder set in potf.seed.js: both are matched most-specific-first, and
 * a transcribed day (season + week + weekday) always beats a season-level
 * placeholder.
 *
 * Formatting conventions, kept faithful to the printed page:
 *  - The book prints two responses separated by "Or"; both are carried, and the
 *    document renders them exactly that way.
 *  - Each intention ends with "Let us pray to the Lord." in the book. That
 *    closing is added at render time, so it is NOT stored here.
 *  - Concluding prayers end "Amen." in the book. "Amen." is likewise appended at
 *    render time, so it is left off.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Sections in the order the book prints them. */
const SECTIONS = ['advent', 'christmas', 'lent', 'easter', 'solemnities', 'ordinary-time'];

export const ORILLO_DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/orillo',
);

function readSection(section) {
  const file = path.join(ORILLO_DATA_DIR, `${section}.json`);
  if (!fs.existsSync(file)) return null;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    // A malformed file is a mistake worth stopping for: seeding past it would
    // silently leave the office praying placeholders.
    throw new Error(`${file} is not valid JSON.`, { cause });
  }

  const prayers = Array.isArray(parsed) ? parsed : parsed.prayers;
  if (!Array.isArray(prayers)) {
    throw new Error(`${file} has no "prayers" array.`);
  }
  return prayers;
}

/**
 * Every transcribed prayer, or an empty list when the office's data directory
 * is not on this machine. `missing` names the sections that were not found, so
 * the seeder can say so out loud rather than quietly under-seeding.
 */
export function loadOrilloSeeds() {
  const seeds = [];
  const missing = [];

  for (const section of SECTIONS) {
    const prayers = readSection(section);
    if (prayers === null) missing.push(section);
    else seeds.push(...prayers);
  }

  return { seeds, missing };
}

export const ORILLO_SEEDS = loadOrilloSeeds().seeds;

export default ORILLO_SEEDS;
