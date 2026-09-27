/**
 * Builds client/src/api/seed.json - the data the client's demo mode answers
 * its own requests from.
 *
 *   node server/tools/build-demo-seed.mjs
 *
 * Two things are deliberately NOT in the output, because the file it writes is
 * committed to a public repository:
 *
 *   1. Scripture text. The readings LiturgyGen fetches are the New American
 *      Bible, copyright USCCB and the Confraternity of Christian Doctrine.
 *      Citations are references and are fine; the text itself is not ours to
 *      redistribute. Every body of text is replaced with one stand-in line.
 *   2. The office's Prayers of the Faithful. Those are transcribed from two
 *      published ST PAULS volumes and never leave server/data/orillo. Only the
 *      placeholder prayers written for this tool are included.
 *
 * The liturgical calendar itself is computed, factual, and safe to ship.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMonth } from '../src/services/calendarService.js';
import { buildDay } from '../src/services/compositionService.js';
import { DEFAULT_SETTINGS } from '../src/db/index.js';
import { DEFAULT_STYLE } from '../src/services/docxService.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'client', 'src', 'api', 'seed.json');

const MONTHS = [[2026, 9], [2026, 10]];
const DAYS = ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-08', '2026-09-23', '2026-10-01'];

const STAND_IN = 'The text of this reading is not included in the demo. Run the real API to fetch it from USCCB.';

/** Keep the shape, drop the scripture. */
function redactPassage(passage) {
  if (!passage) return null;
  return { ...passage, lines: [STAND_IN] };
}

function redactPsalm(psalm) {
  if (!psalm) return null;
  return {
    ...psalm,
    stanzas: (psalm.stanzas || []).slice(0, 1).map((stanza) => ({ ...stanza, lines: [STAND_IN] })),
  };
}

function redactAcclamation(acclamation) {
  if (!acclamation) return null;
  return { ...acclamation, verse: [STAND_IN] };
}

const months = {};
for (const [year, month] of MONTHS) {
  months[`${year}-${month}`] = await getMonth(year, month);
}

const readings = {};
const previews = {};
for (const iso of DAYS) {
  let day;
  try {
    day = await buildDay(iso, {});
  } catch (error) {
    console.warn(`  skipped ${iso}: ${error.message}`);
    continue;
  }
  if (day.readings) {
    readings[iso] = {
      ...day.readings,
      reading1: redactPassage(day.readings.reading1),
      reading2: redactPassage(day.readings.reading2),
      gospel: redactPassage(day.readings.gospel),
      sequence: redactPassage(day.readings.sequence),
      psalm: redactPsalm(day.readings.psalm),
      acclamation: redactAcclamation(day.readings.acclamation),
      alternatives: [],
      source: 'demo',
      sourceUrl: null,
    };
  }
  previews[iso] = {
    date: day.date,
    headerDate: day.headerDate,
    fileName: day.fileName,
    occasionTitle: day.occasionTitle,
    liturgy: day.liturgy,
    potfMatch: day.potfMatch,
    isComplete: day.isComplete,
  };
  console.log(`  ${iso}  ${day.occasionTitle}`);
}

const seed = {
  generatedAt: new Date().toISOString().slice(0, 10),
  note:
    'Demo data for the GitHub Pages build. Scripture text and the office\'s own prayers ' +
    'are deliberately excluded; see server/tools/build-demo-seed.mjs.',
  months,
  previews,
  readings,
  settings: DEFAULT_SETTINGS,
  defaults: DEFAULT_SETTINGS,
  style: DEFAULT_STYLE,
  seasons: ['Advent', 'Christmas', 'Lent', 'Easter', 'Ordinary Time', 'Feast', 'Solemnity'],
  templates: [
    {
      id: 1,
      title: 'Placeholder - Ordinary Time',
      season: 'Ordinary Time',
      week: null,
      dayOfWeek: null,
      celebrationId: null,
      fixedDate: null,
      priestInvitation: 'Let us bring our needs before the Lord, who hears every prayer.',
      responseOptions: ['Lord, hear our prayer.'],
      intentions: [
        'For the Church, that she may be a sign of hope for all people, let us pray to the Lord.',
        'For those who govern, that they may serve the common good, let us pray to the Lord.',
        'For our school community, that our work and study may give glory to God, let us pray to the Lord.',
        'For the sick and the suffering, that they may know God’s comfort, let us pray to the Lord.',
        'For the faithful departed, that they may rest in peace, let us pray to the Lord.',
      ],
      priestConclusion:
        'Father, hear the prayers of your people and grant what we ask in faith. Through Christ our Lord.',
      notes: null,
      origin: 'placeholder',
      isPlaceholder: true,
      isActive: true,
    },
    {
      id: 2,
      title: 'Placeholder - Advent',
      season: 'Advent',
      week: null,
      dayOfWeek: null,
      celebrationId: null,
      fixedDate: null,
      priestInvitation: 'As we wait in joyful hope, let us place our needs before the Lord.',
      responseOptions: ['Come, Lord Jesus.', 'Lord, hear our prayer.'],
      intentions: [
        'For the Church, that she may prepare the way of the Lord, let us pray to the Lord.',
        'For all who wait in darkness, that they may see the light of Christ, let us pray to the Lord.',
        'For our community, that this season may find us watchful, let us pray to the Lord.',
        'For the faithful departed, that they may see the Lord’s face, let us pray to the Lord.',
      ],
      priestConclusion: 'God of hope, hear the prayers of your waiting people. Through Christ our Lord.',
      notes: null,
      origin: 'placeholder',
      isPlaceholder: true,
      isActive: true,
    },
    {
      id: 3,
      title: 'Placeholder - Lent',
      season: 'Lent',
      week: null,
      dayOfWeek: null,
      celebrationId: null,
      fixedDate: null,
      priestInvitation: 'Turning back to the Lord with all our heart, let us pray.',
      responseOptions: ['Lord, hear our prayer.', 'Have mercy on us, O Lord.'],
      intentions: [
        'For the Church, that this season may renew her, let us pray to the Lord.',
        'For those preparing for baptism, that they may be strengthened, let us pray to the Lord.',
        'For the hungry and the homeless, that we may not pass them by, let us pray to the Lord.',
        'For ourselves, that our fasting may become mercy, let us pray to the Lord.',
      ],
      priestConclusion: 'Merciful Father, hear the prayers of your people this season. Through Christ our Lord.',
      notes: null,
      origin: 'placeholder',
      isPlaceholder: true,
      isActive: true,
    },
  ],
  schedule: [
    { date: '2026-09-02', label: 'First Wednesday Mass', notes: null },
    { date: '2026-09-04', label: 'First Friday Mass', notes: null },
    { date: '2026-09-08', label: 'Nativity of the Blessed Virgin Mary', notes: null },
  ],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(seed, null, 1)}\n`);
console.log(`\nwrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
