import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as usccb from '../src/services/providers/usccbProvider.js';
import * as evangelizo from '../src/services/providers/evangelizoProvider.js';
import { auditReadings } from '../src/lib/readingsShape.js';
import { readingIntroLine, bookKeyFromName, citationAbbrev } from '../src/lib/bibleBooks.js';
import {
  datesInMonth,
  formatHeaderDate,
  nthWeekdayOfMonth,
  readingsFileName,
  toUsccbSlug,
} from '../src/lib/dates.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const readFixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

test('date helpers produce the office naming conventions', () => {
  assert.equal(formatHeaderDate('2024-12-04'), 'DECEMBER 04, 2024');
  assert.equal(toUsccbSlug('2024-12-04'), '120424');
  assert.equal(readingsFileName('2024-12-04'), 'READINGS-December-04-2024-Wednesday.docx');
  assert.equal(toUsccbSlug('2026-01-05'), '010526');
});

test('month expansion honours weekday filters and nth-weekday rules', () => {
  assert.equal(datesInMonth(2026, 10).length, 31);
  assert.equal(datesInMonth(2026, 10, { weekdays: [1, 2, 3, 4, 5] }).length, 22);
  assert.equal(nthWeekdayOfMonth(2026, 10, 5, 1), '2026-10-02');
  assert.equal(nthWeekdayOfMonth(2026, 2, 0, 5), null);
});

/* ------------------------------------------------------------------ *
 * Citations
 * ------------------------------------------------------------------ */

test('reading introductions are rebuilt from NAB citations', () => {
  assert.equal(readingIntroLine('Is 25:6-10a'), 'A reading from the Book of the Prophet Isaiah');
  assert.equal(
    readingIntroLine('1 Cor 12:12-14, 27'),
    'A reading from the first Letter of Saint Paul to the Corinthians',
  );
  assert.equal(readingIntroLine('Mt 15:29-37'), 'A reading from the holy Gospel according to Matthew');
  assert.equal(readingIntroLine('Acts 2:1-11'), 'A reading from the Acts of the Apostles');
  assert.equal(readingIntroLine('Heb 1:1-6'), 'A reading from the Letter to the Hebrews');
  assert.equal(readingIntroLine('Nonsense 1:1'), null);
});

test('spelled-out book names resolve to citation abbreviations', () => {
  assert.equal(citationAbbrev(bookKeyFromName('First Letter to the Corinthians')), '1 Cor');
  assert.equal(citationAbbrev(bookKeyFromName('Book of the Prophet Isaiah')), 'Is');
  assert.equal(
    citationAbbrev(bookKeyFromName('Holy Gospel of Jesus Christ according to Saint Luke')),
    'Lk',
  );
  assert.equal(bookKeyFromName('Not A Book'), null);
});

/* ------------------------------------------------------------------ *
 * USCCB parser - checked against the office's own sample document
 * ------------------------------------------------------------------ */

test('USCCB page parses into the exact content of the sample missalette', () => {
  const readings = usccb.parse(readFixture('usccb-2024-12-04.html'), '2024-12-04');

  assert.equal(readings.reading1.citation, 'Is 25:6-10a');
  assert.equal(readings.reading1.intro, 'A reading from the Book of the Prophet Isaiah');
  assert.equal(readings.reading1.lines[0], 'On this mountain the LORD of hosts');
  // The blank line is the stanza break the lectionary prints.
  assert.equal(readings.reading1.lines[12], '');
  assert.equal(readings.reading1.lines.at(-1), 'For the hand of the LORD will rest on this mountain.');

  assert.equal(readings.psalm.citation, 'Ps 23:1-3a, 3b-4, 5, 6');
  assert.equal(
    readings.psalm.refrain,
    'I shall live in the house of the Lord all the days of my life.',
  );
  assert.equal(readings.psalm.stanzas.length, 4);
  assert.equal(readings.psalm.stanzas[0][0], 'The LORD is my shepherd; I shall not want.');

  assert.equal(readings.acclamation.refrain, 'Alleluia, alleluia.');
  assert.deepEqual(readings.acclamation.verse, [
    'Behold, the Lord comes to save his people;',
    'blessed are those prepared to meet him.',
  ]);

  assert.equal(readings.gospel.citation, 'Mt 15:29-37');
  assert.equal(readings.reading2, null);
  assert.deepEqual(auditReadings(readings), []);
});

test('the psalm verse marker "(6cd)" is stripped from the response', () => {
  const { refrain } = usccb.parsePsalmBody(
    ['R. (6cd) I shall live in the house of the Lord.', 'The LORD is my shepherd;'],
    null,
  );
  assert.equal(refrain, 'I shall live in the house of the Lord.');
});

test('a psalm with an alternative response keeps its real stanzas', () => {
  // USCCB offers a second response on many days, printed as
  //   R. (26a) Blessed is he ...  /  or:  /  R. Alleluia.
  // The bare "or:" used to survive as a one-line stanza between every real one,
  // so a three-part psalm came out as seven stanzas of mostly nothing.
  const { refrain, refrainAlt, stanzas } = usccb.parsePsalmBody(
    [
      'R. (26a) Blessed is he who comes in the name of the Lord.',
      'or:',
      'R. Alleluia.',
      'Give thanks to the LORD, for he is good,',
      'for his mercy endures forever.',
      'R. Blessed is he who comes in the name of the Lord.',
      'or:',
      'R. Alleluia.',
      'Open to me the gates of justice;',
      'I will enter them and give thanks to the LORD.',
      'R. Blessed is he who comes in the name of the Lord.',
      'or:',
      'R. Alleluia.',
    ],
    null,
  );

  assert.equal(refrain, 'Blessed is he who comes in the name of the Lord.');
  assert.equal(refrainAlt, 'Alleluia.');
  assert.equal(stanzas.length, 2);
  assert.deepEqual(stanzas[0], [
    'Give thanks to the LORD, for he is good,',
    'for his mercy endures forever.',
  ]);
  assert.ok(!stanzas.flat().some((line) => /^or:?$/i.test(line)));
});

test('an acclamation with an alternative response drops the connector', () => {
  const { refrain, verse } = usccb.parseAcclamationBody(
    ['R. Alleluia, alleluia.', 'or:', 'R. Praise to you, Lord Jesus Christ.', 'Behold, the Lord comes.'],
    null,
  );
  assert.equal(refrain, 'Alleluia, alleluia.');
  assert.deepEqual(verse, ['Behold, the Lord comes.']);
});

test('the bot-check page is detected and never parsed as readings', () => {
  const challenge = readFixture('usccb-challenge.html');
  assert.equal(usccb.isChallengePage(challenge), true);
  assert.throws(
    () => usccb.parse(challenge, '2024-12-05'),
    (error) => error.code === 'USCCB_CHALLENGE',
  );
});

test('block headings map to the right section', () => {
  assert.equal(usccb.classifyHeading('Reading 1'), 'reading1');
  assert.equal(usccb.classifyHeading('Reading II'), 'reading2');
  assert.equal(usccb.classifyHeading('Responsorial Psalm'), 'psalm');
  assert.equal(usccb.classifyHeading('Alleluia'), 'acclamation');
  assert.equal(usccb.classifyHeading('Verse Before the Gospel'), 'acclamation');
  assert.equal(usccb.classifyHeading('Gospel'), 'gospel');
  assert.equal(usccb.classifyHeading('Podcast'), null);
});

/* ------------------------------------------------------------------ *
 * Evangelizo fallback
 * ------------------------------------------------------------------ */

test('Evangelizo references are converted to lectionary style', () => {
  assert.equal(evangelizo.normaliseReference('9,1-12.14-16.'), '9:1-12, 14-16');
  assert.equal(evangelizo.normaliseReference('139(138),1-3.13-14ab.23-24.'), '139:1-3, 13-14ab, 23-24');
  assert.equal(evangelizo.normaliseReference('23,20-23.'), '23:20-23');
});

test('Evangelizo splits the title from the first reading', () => {
  const body = [
    'Wednesday of the Twenty-sixth week in Ordinary Time',
    '<br /><br />',
    'Book of Job <font dir="ltr">9,1-12.</font>',
    '<br />',
    'Job answered his friends and said:<br />',
    'I know well that it is so.',
    '<br /><br /><br />',
    'Psalms <font dir="ltr">88(87),10-15.</font>',
    '<br />',
    'Daily I call upon you, O LORD;<br />to you I stretch out my hands.',
    '<br /><br /><br />',
    'Holy Gospel of Jesus Christ according to Saint Luke <font dir="ltr">9,57-62.</font>',
    '<br />',
    'As Jesus and his disciples were proceeding on their journey.',
  ].join('\n');

  const readings = evangelizo.parse(body, '2026-09-30');
  assert.equal(readings.liturgicalTitle, 'Wednesday of the Twenty-sixth week in Ordinary Time');
  assert.equal(readings.reading1.citation, 'Jb 9:1-12');
  assert.equal(readings.reading1.lines[0], 'Job answered his friends and said:');
  assert.equal(readings.psalm.citation, 'Ps 88:10-15');
  assert.equal(readings.gospel.citation, 'Lk 9:57-62');
  // The feed carries neither of these, and the audit must say so.
  const gaps = auditReadings(readings);
  assert.ok(gaps.some((gap) => gap.includes('response')));
  assert.ok(gaps.some((gap) => gap.includes('Acclamation')));
});

test('Evangelizo refuses dates outside its 30-day window', () => {
  const today = new Date('2026-09-05T00:00:00Z');
  assert.equal(evangelizo.supportsDate('2026-09-20', today), true);
  assert.equal(evangelizo.supportsDate('2026-12-25', today), false);
});

/* ------------------------------------------------------------------ *
 * Optional ("or") readings
 * ------------------------------------------------------------------ */

test('a block headed "or" is an alternative to the section before it', () => {
  assert.equal(usccb.isAlternativeHeading('or'), true);
  assert.equal(usccb.isAlternativeHeading('Or:'), true);
  assert.equal(usccb.isAlternativeHeading('Gospel'), false);
  assert.equal(usccb.isAlternativeHeading(''), false);
});

test('optional readings take the first option and record the rest', () => {
  // 8 September 2026, the Nativity of the BVM: the lectionary offers a choice of
  // First Reading (Micah or Romans) and of Gospel (long or short form).
  const readings = usccb.parse(readFixture('usccb-2026-09-08-optional.html'), '2026-09-08');

  assert.equal(readings.reading1.citation, 'Micah 5:1-4a');
  assert.equal(readings.gospel.citation, 'Matthew 1:1-16, 18-23');
  // The alternative must never be mistaken for a Second Reading.
  assert.equal(readings.reading2, null);
  assert.deepEqual(auditReadings(readings), []);

  assert.deepEqual(
    readings.alternatives.map((alternative) => ({
      kind: alternative.kind,
      citation: alternative.citation,
    })),
    [
      { kind: 'reading1', citation: 'Romans 8:28-30' },
      { kind: 'gospel', citation: 'Matthew 1:18-23' },
    ],
  );
});

test('an optional reading fills its section when the first option is unusable', () => {
  const html = `
    <div class="wr-block b-verse">
      <div class="content-header"><div class="name">Reading 1</div>
        <div class="address"><a>Mi 5:1-4a</a></div></div>
      <div class="content-body"><p></p></div>
    </div>
    <div class="wr-block b-verse">
      <div class="content-header"><div class="name">or</div>
        <div class="address"><a>Rom 8:28-30</a></div></div>
      <div class="content-body"><p>Brothers and sisters:<br>We know that all things work for good.</p></div>
    </div>
    <div class="wr-block b-verse">
      <div class="content-header"><div class="name">Gospel</div>
        <div class="address"><a>Mt 1:18-23</a></div></div>
      <div class="content-body"><p>This is how the birth of Jesus Christ came about.</p></div>
    </div>`;

  const readings = usccb.parse(html, '2026-09-08');
  assert.equal(readings.reading1.citation, 'Rom 8:28-30');
  assert.equal(readings.reading1.lines[0], 'Brothers and sisters:');
});

/* ------------------------------------------------------------------ *
 * Line breaks
 * ------------------------------------------------------------------ */

test('a newline after <br> in the source is not a stanza break', () => {
  // USCCB's CMS writes most pages as "line<br>line", but feast days come back
  // as "line<br>\nline". Both mean one line break. Treating the source newline
  // as a second one put a blank line between every line of the reading.
  const html = `
    <div class="wr-block b-verse">
      <div class="content-header"><div class="name">Reading 1</div>
        <div class="address"><a>Mi 5:1-4a</a></div></div>
      <div class="content-body">
        <p>The LORD says:<br>
You, Bethlehem-Ephrathah,<br>
too small to be among the clans of Judah,<br>
<br>
He shall stand firm and shepherd his flock,<br>
he shall be peace.</p>
      </div>
    </div>
    <div class="wr-block b-verse">
      <div class="content-header"><div class="name">Gospel</div>
        <div class="address"><a>Mt 1:18-23</a></div></div>
      <div class="content-body"><p>This is how the birth of Jesus Christ came about.</p></div>
    </div>`;

  const readings = usccb.parse(html, '2026-09-08');

  assert.deepEqual(readings.reading1.lines, [
    'The LORD says:',
    'You, Bethlehem-Ephrathah,',
    'too small to be among the clans of Judah,',
    // A doubled <br> is a real stanza break and survives as one blank line.
    '',
    'He shall stand firm and shepherd his flock,',
    'he shall be peace.',
  ]);
});

test('the feast-day page reads with the same line breaks as a ferial one', () => {
  const readings = usccb.parse(readFixture('usccb-2026-09-08-optional.html'), '2026-09-08');
  const blanks = readings.reading1.lines.filter((line) => line === '').length;

  assert.equal(readings.reading1.lines[0], 'The LORD says:');
  assert.equal(readings.reading1.lines[1], 'You, Bethlehem-Ephrathah,');
  // Micah 5:1-4a is printed as two stanzas, so one blank line - not sixteen.
  assert.ok(blanks <= 2, `expected at most 2 stanza breaks, got ${blanks}`);
});
