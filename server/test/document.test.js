import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';

import * as usccb from '../src/services/providers/usccbProvider.js';
import { buildCombinedDocx, buildDayDocx, buildDayParagraphs } from '../src/services/docxService.js';
import { formatOccasionTitle, getLiturgicalDay, numericOrdinal, wordOrdinal } from '../src/services/calendarService.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// Invented for the tests. Nothing here is taken from the office's books, so
// this file stays safe to commit - see seeds/orillo.seed.js.
const POTF = {
  priestInvitation: 'Let us bring the needs of this school before the Father.',
  responseOptions: ['Lord, hear our prayer.', 'Father, provide for your people.'],
  intentions: [
    'For our teachers, that they may teach with patience',
    'For those who govern, that they may serve the poor',
    'For the hungry, that they may be filled',
    'For our students, that they may grow in faith',
    'For our dead, that they may rest in peace',
  ],
  priestConclusion: 'Father, hear the prayers of your household.',
};

function sampleDay() {
  const readings = usccb.parse(
    fs.readFileSync(path.join(FIXTURES, 'usccb-2024-12-04.html'), 'utf8'),
    '2024-12-04',
  );
  return {
    date: '2024-12-04',
    occasionTitle: 'FIRST WEEK OF ADVENT - WEDNESDAY',
    readings,
    potf: POTF,
  };
}

/** Pull word/document.xml out of a .docx buffer without extra dependencies. */
function documentXml(buffer) {
  // Locate the local file header for word/document.xml and inflate it.
  const name = Buffer.from('word/document.xml');
  let offset = 0;
  while (offset < buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const entryName = buffer.subarray(offset + 30, offset + 30 + nameLength);
    const dataStart = offset + 30 + nameLength + extraLength;
    if (entryName.equals(name)) {
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    offset = dataStart + compressedSize;
  }
  throw new Error('word/document.xml not found in the .docx');
}

/* ------------------------------------------------------------------ *
 * Liturgical titles
 * ------------------------------------------------------------------ */

test('ordinals follow the house style of each season', () => {
  assert.equal(numericOrdinal(1), '1st');
  assert.equal(numericOrdinal(2), '2nd');
  assert.equal(numericOrdinal(3), '3rd');
  assert.equal(numericOrdinal(11), '11th');
  assert.equal(numericOrdinal(33), '33rd');
  assert.equal(wordOrdinal(1), 'FIRST');
  assert.equal(wordOrdinal(22), 'TWENTY-SECOND');
});

test('the printed heading matches the office sample', async () => {
  const advent = await getLiturgicalDay('2024-12-04');
  assert.equal(advent.occasionTitle, 'FIRST WEEK OF ADVENT - WEDNESDAY');

  const ordinary = await getLiturgicalDay('2026-11-25');
  assert.equal(ordinary.occasionTitle, '34th WEEK IN ORDINARY TIME - WEDNESDAY');

  // Not a January Sunday: in the Philippines the third one is the Santo Nino.
  const sunday = await getLiturgicalDay('2026-02-08');
  assert.equal(sunday.occasionTitle, '5th SUNDAY IN ORDINARY TIME');
});

test('the Philippines calendar is in use', async () => {
  const patroness = await getLiturgicalDay('2026-12-08');
  assert.match(patroness.celebration.name, /Patroness of the Philippines/);
  assert.equal(patroness.celebration.rank, 'SOLEMNITY');

  const cycles = await getLiturgicalDay('2026-09-05');
  // The 2026 Ordo for the Philippines is Cycle A, Year II.
  assert.equal(cycles.cycles.sunday, 'YEAR_A');
  assert.equal(cycles.cycles.weekday, 'YEAR_2');
});

test('feasts are titled by name, not by week', () => {
  const feast = { rank: 'MEMORIAL', name: 'Saint Lawrence Ruiz and Companions, Martyrs', seasons: ['ORDINARY_TIME'], calendar: { weekOfSeason: 26 } };
  assert.equal(formatOccasionTitle(feast, '2026-09-28'), 'SAINT LAWRENCE RUIZ AND COMPANIONS, MARTYRS');
});

/* ------------------------------------------------------------------ *
 * Document structure
 * ------------------------------------------------------------------ */

test('a generated page has the sections of the sample, in order', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  const text = xml.replace(/<[^>]+>/g, '');

  const order = [
    'DECEMBER 04, 2024',
    'LITURGY OF THE WORD',
    'FIRST READING',
    'A reading from the Book of the Prophet Isaiah',
    'The Word of the Lord.',
    'All: Thanks be to God.',
    'RESPONSORIAL PSALM',
    'Alleluia, alleluia.',
    'Commentator',
    'FIRST WEEK OF ADVENT - WEDNESDAY',
    'Priest:',
    'LORD, HEAR OUR PRAYER.',
    'OR',
    'FATHER, PROVIDE FOR YOUR PEOPLE.',
    'Let us pray to the Lord.',
  ];

  let cursor = -1;
  for (const needle of order) {
    const found = text.indexOf(needle, cursor + 1);
    assert.ok(found > cursor, `"${needle}" is missing or out of order`);
    cursor = found;
  }
});

test('the citation is right-aligned with a tab stop, not typed spaces', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  assert.match(xml, /<w:tab w:val="right" w:pos="9630"\/>/);
  assert.ok(!/ {6,}Is 25/.test(xml), 'the citation should not be padded with literal spaces');
});

test('the first psalm response is capitalised and later ones are not', async () => {
  const text = documentXml(await buildDayDocx(sampleDay())).replace(/<[^>]+>/g, '');
  assert.ok(text.includes('I SHALL LIVE IN THE HOUSE OF THE LORD ALL THE DAYS OF MY LIFE.'));
  assert.ok(text.includes('I shall live in the house of the Lord all the days of my life.'));
});

test('the Gospel is omitted by default and included on request', async () => {
  const withoutGospel = documentXml(await buildDayDocx(sampleDay())).replace(/<[^>]+>/g, '');
  assert.ok(!withoutGospel.includes('Mt 15:29-37'));

  const withGospel = documentXml(
    await buildDayDocx(sampleDay(), { options: { includeGospel: true } }),
  ).replace(/<[^>]+>/g, '');
  assert.ok(withGospel.includes('Mt 15:29-37'));
  assert.ok(withGospel.includes('The Gospel of the Lord.'));
});

test('intentions are numbered and closed with the standard response', async () => {
  const text = documentXml(await buildDayDocx(sampleDay())).replace(/<[^>]+>/g, '');
  for (let n = 1; n <= 5; n += 1) assert.ok(text.includes(`${n}. `), `intention ${n} is missing`);
  assert.equal((text.match(/Let us pray to the Lord\./g) || []).length, 5);
});

test('"Amen." is appended to a conclusion that lacks it, and never doubled', async () => {
  const once = documentXml(await buildDayDocx(sampleDay())).replace(/<[^>]+>/g, '');
  assert.equal((once.match(/Amen\./g) || []).length, 1);

  const day = sampleDay();
  day.potf = { ...POTF, priestConclusion: 'Through Christ our Lord. Amen.' };
  const already = documentXml(await buildDayDocx(day)).replace(/<[^>]+>/g, '');
  assert.equal((already.match(/Amen\./g) || []).length, 1);
});

test('a combined document separates dates with page breaks', async () => {
  const first = sampleDay();
  const second = { ...sampleDay(), date: '2024-12-05', occasionTitle: 'FIRST WEEK OF ADVENT - THURSDAY' };
  const xml = documentXml(await buildCombinedDocx([first, second]));

  assert.equal((xml.match(/w:type="page"/g) || []).length, 1);
  const text = xml.replace(/<[^>]+>/g, '');
  assert.ok(text.includes('DECEMBER 04, 2024'));
  assert.ok(text.includes('DECEMBER 05, 2024'));
});

test('a day with no Prayers of the Faithful still renders its readings', () => {
  const day = { ...sampleDay(), potf: null };
  const paragraphs = buildDayParagraphs(day);
  assert.ok(paragraphs.length > 20);
});

/* ------------------------------------------------------------------ *
 * Page separation
 * ------------------------------------------------------------------ */

/** The paragraphs that open a page, in order, as plain text. */
function pageOpeners(xml) {
  // Paragraphs are written both as "<w:p>" and "<w:p w:rsidR=...>", so match either.
  const paragraphs = [...xml.matchAll(/<w:p(?:[ ][^>]*)?>([\s\S]*?)<\/w:p>/g)].map((m) => m[1]);
  return paragraphs
    .filter((p) => /<w:pageBreakBefore/.test(p))
    .map((p) => p.replace(/<[^>]+>/g, '').trim());
}

test('each reading and the prayers open their own page', async () => {
  const day = sampleDay();
  day.readings.reading2 = {
    citation: 'Rom 8:1-4',
    intro: 'A reading from the Letter of Saint Paul to the Romans',
    lines: ['Brothers and sisters:'],
  };
  const xml = documentXml(await buildDayDocx(day, { options: { includeGospel: true } }));

  const openers = pageOpeners(xml);
  assert.ok(openers[0].startsWith('RESPONSORIAL PSALM'), `got "${openers[0]}"`);
  assert.ok(openers[1].startsWith('SECOND READING'), `got "${openers[1]}"`);
  assert.ok(openers[2].startsWith('GOSPEL'), `got "${openers[2]}"`);
  assert.equal(openers[3], 'FIRST WEEK OF ADVENT - WEDNESDAY');
  assert.equal(openers.length, 4);
});

test('the first reading is not pushed onto a page of its own', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  // A break before the very first section would leave page one blank.
  assert.ok(!pageOpeners(xml).some((opener) => opener.startsWith('FIRST READING')));
});

test('the psalm and the acclamation share a page on a weekday', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  const openers = pageOpeners(xml);

  // Three pages: the reading, the psalm with the Alleluia, then the prayers.
  // Nothing opens a page between the psalm and the occasion title, so the
  // Alleluia sits with the psalm.
  assert.equal(openers.length, 2);
  assert.ok(openers[0].startsWith('RESPONSORIAL PSALM'), `got "${openers[0]}"`);
  assert.equal(openers[1], 'FIRST WEEK OF ADVENT - WEDNESDAY');
});

test('page separation can be turned off', async () => {
  const xml = documentXml(
    await buildDayDocx(sampleDay(), { options: { separatePages: false } }),
  );
  assert.equal(pageOpeners(xml).length, 0);
});

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

test('headings are printed in the maroon of the office sample', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  const heading = xml.slice(xml.indexOf('FIRST READING') - 400, xml.indexOf('FIRST READING'));
  assert.match(heading, /<w:color w:val="C00000"\/>/);
});

test('only the opening psalm response is highlighted', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));

  assert.equal((xml.match(/<w:highlight w:val="yellow"\/>/g) || []).length, 2, 'the "R." and the refrain');

  // The repeats between stanzas take the lighter red and no highlight.
  assert.ok((xml.match(/<w:color w:val="FF0000"\/>/g) || []).length > 0);
});

test('the highlight can be removed without losing the colour', async () => {
  const xml = documentXml(
    await buildDayDocx(sampleDay(), { options: { highlightFirstRefrain: null } }),
  );
  assert.equal((xml.match(/<w:highlight/g) || []).length, 0);
  assert.ok((xml.match(/<w:color w:val="C00000"\/>/g) || []).length > 0);
});

test('the page uses the sample document geometry', async () => {
  const xml = documentXml(await buildDayDocx(sampleDay()));
  assert.match(xml, /w:w="12240"/);
  assert.match(xml, /w:h="15840"/);
  assert.match(xml, /w:left="1440"/);
  assert.match(xml, /w:right="1170"/);
});
