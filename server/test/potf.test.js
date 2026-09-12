/**
 * Template resolution, against a throwaway database so the office's own data is
 * never touched.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.DB_FILE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'liturgygen-test-')),
  'test.sqlite',
);

const { seedPotfTemplates } = await import('../src/db/seed.js');
const { resolveForDay, createTemplate } = await import('../src/services/potfService.js');
const { getLiturgicalDay } = await import('../src/services/calendarService.js');
const { parseOrilloPage } = await import('../src/lib/orilloParser.js');
const { loadOrilloSeeds } = await import('../src/db/seeds/orillo.seed.js');

seedPotfTemplates();

// The office's transcriptions are not in this repository, so a clean checkout
// (and CI) seeds the placeholders alone. Tests that assert against the book's
// own titles are skipped there rather than failing - everything testing the
// resolution logic itself runs either way.
const needsOrillo = loadOrilloSeeds().missing.length
  ? { skip: 'requires the office transcriptions in server/data/orillo' }
  : {};

const resolveIso = async (iso) => resolveForDay((await getLiturgicalDay(iso)).potfLookup);

test('a transcribed weekday is matched exactly', async () => {
  const wednesday = await resolveIso('2024-12-04');
  assert.equal(wednesday.matchedBy, 'season + week + day');
  assert.match(wednesday.template.title, /Advent, Week 1 - Wednesday/);
  // The book prints both responses with OR between them. The text itself is
  // not asserted here: it comes from the office's transcription, which is not
  // in this repository - see seeds/orillo.seed.js.
  assert.equal(wednesday.template.responseOptions.length, 2);
  assert.equal(wednesday.template.responseOptions[0], 'Lord, hear our prayer.');
  assert.equal(wednesday.template.intentions.length, 5);
});

test('a memorial in a season keeps that season’s weekday prayer', needsOrillo, async () => {
  // 3 December is Saint Francis Xavier, an ordinary memorial falling in the
  // first week of Advent. The office prays the Advent weekday, not a generic
  // feast text - the whole-season catch-all must not outrank it.
  const memorial = await resolveIso('2024-12-03');
  assert.match(memorial.matchedBy, /ferial fallback/);
  assert.match(memorial.template.title, /Advent, Week 1 - Tuesday/);

  const ambrose = await resolveIso('2024-12-07');
  assert.match(ambrose.template.title, /Advent, Week 1 - Saturday/);
});

test('a day with nothing transcribed still resolves to something printable', async () => {
  const week2 = await resolveIso('2024-12-09');
  assert.ok(week2.template, 'every day must yield a template');
  assert.ok(week2.template.intentions.length >= 4);
  assert.ok(week2.template.priestInvitation.length > 0);
  assert.ok(week2.template.priestConclusion.length > 0);
});

test('intentions carry no trailing response - the document adds it', async () => {
  const monday = await resolveIso('2024-12-02');
  for (const intention of monday.template.intentions) {
    assert.ok(
      !/let us pray to the lord/i.test(intention),
      `"${intention}" already ends with the response`,
    );
  }
  assert.ok(!/\bAmen\.?\s*$/i.test(monday.template.priestConclusion));
});

/* ------------------------------------------------------------------ *
 * Ordinary Time fallback
 * ------------------------------------------------------------------ */

test('a day with no prayer of its own takes the Ordinary Time prayer for that weekday', async () => {
  // A day with no proper template should fall back to
  // the Ordinary Time prayer for the same day of the week - not to the generic
  // whole-season placeholder.
  const unseeded = resolveForDay({
    season: 'Triduum',
    ferialSeason: 'Triduum',
    week: null,
    dayOfWeek: 'Tuesday',
    celebrationId: 'untranscribed_day',
  });
  assert.match(unseeded.matchedBy, /Ordinary Time fallback/);
  assert.equal(unseeded.template.title, 'Ordinary Time - Tuesday');

  const unseededFriday = resolveForDay({
    season: 'Triduum',
    ferialSeason: 'Triduum',
    week: null,
    dayOfWeek: 'Friday',
    celebrationId: 'untranscribed_day',
  });
  assert.match(unseededFriday.matchedBy, /Ordinary Time fallback/);
  assert.equal(unseededFriday.template.title, 'Ordinary Time - Friday');
});

test('the fallback never displaces a prayer the day actually has', needsOrillo, async () => {
  const advent = await resolveIso('2026-12-02');
  assert.equal(advent.matchedBy, 'season + week + day');
  assert.match(advent.template.title, /Advent, Week 1 - Wednesday/);

  const lent = await resolveIso('2026-02-24');
  assert.equal(lent.matchedBy, 'season + week + day');
  assert.match(lent.template.title, /First Week of Lent - Tuesday/);

  const christmas = await resolveIso('2026-12-25');
  assert.equal(christmas.matchedBy, 'celebration');
  assert.match(christmas.template.title, /Nativity of the Lord/);

  // A day already in Ordinary Time matches directly, not through the fallback.
  const ordinary = await resolveIso('2026-06-19');
  assert.equal(ordinary.matchedBy, 'season + week + day');
  assert.match(ordinary.template.title, /Ordinary Time, Week 11 - Friday/);
});

/* ------------------------------------------------------------------ *
 * Days the book fixes to a calendar date
 *
 * The Philippines transfers Epiphany to a Sunday, so early January has no
 * stable celebration id: 2 January is a memorial in 2027 but Epiphany itself
 * in 2028. A month-and-day rule covers those days without ever displacing a
 * solemnity that lands on the same date.
 * ------------------------------------------------------------------ */

test('a template keyed to a calendar date is found on that date', async () => {
  createTemplate({
    title: 'Second of January (test)',
    season: 'Christmas',
    fixedDate: '01-02',
    priestInvitation: 'Let us pray.',
    responseOptions: ['Lord, hear our prayer.'],
    intentions: ['That the Church may be one'],
    priestConclusion: 'Through Christ our Lord',
  });

  const day = await resolveIso('2027-01-02');
  assert.equal(day.matchedBy, 'calendar date');
  assert.match(day.template.title, /Second of January/);
});

test('a dated feast prayer is not used in a year the feast is not kept', async () => {
  createTemplate({
    title: 'The Annunciation of the Lord (test)',
    season: 'Feast',
    celebrationId: 'annunciation_of_the_lord',
    fixedDate: '03-25',
    priestInvitation: 'Let us pray.',
    responseOptions: ['Lord, hear our prayer.'],
    intentions: ['That we may welcome the Word'],
    priestConclusion: 'Through Christ our Lord',
  });

  // 2026: the Annunciation is kept on its own date, so the prayer is used.
  const kept = await resolveIso('2026-03-25');
  assert.match(kept.template.title, /Annunciation/);

  // 2027: 25 March is Holy Thursday and the Annunciation is transferred away.
  // The date alone must not drag the feast's prayer into the Triduum.
  const holyThursday = await resolveIso('2027-03-25');
  assert.doesNotMatch(holyThursday.template?.title ?? '', /Annunciation/);
});

test('an optional memorial the book has a prayer for still resolves by date', async () => {
  createTemplate({
    title: 'Our Lady of Lourdes (test)',
    season: 'Feast',
    celebrationId: 'our_lady_of_lourdes',
    fixedDate: '02-11',
    priestInvitation: 'Let us pray.',
    responseOptions: ['Lord, hear our prayer.'],
    intentions: ['That the housebound may be remembered'],
    priestConclusion: 'Through Christ our Lord',
  });

  // Lourdes is never the day's assigned celebration - it is always optional -
  // so the date rule is the only way it can be reached.
  const day = await resolveIso('2026-02-11');
  assert.equal(day.matchedBy, 'calendar date');
  assert.match(day.template.title, /Lourdes/);
});

test('a solemnity on the same calendar date still outranks the date rule', async () => {
  createTemplate({
    title: 'The Epiphany of the Lord (test)',
    season: 'Christmas',
    celebrationId: 'epiphany_of_the_lord',
    priestInvitation: 'Let us pray.',
    responseOptions: ['Lord, hear our prayer.'],
    intentions: ['That the nations may see the light'],
    priestConclusion: 'Through Christ our Lord',
  });

  // In 2028 Epiphany falls on 2 January, where the 01-02 template also matches.
  const epiphany = await getLiturgicalDay('2028-01-02');
  assert.equal(epiphany.potfLookup.celebrationId, 'epiphany_of_the_lord');
  assert.equal(epiphany.potfLookup.fixedDate, '01-02');

  const resolved = resolveForDay(epiphany.potfLookup);
  assert.equal(resolved.matchedBy, 'celebration');
  assert.match(resolved.template.title, /Epiphany/);
});

test('a prayer typed off the page can be saved and then resolved', async () => {
  const parsed = parseOrilloPage(`FOURTEENTH OF JANUARY

We bring our needs to the Father.

LORD, HEAR OUR PRAYER.

1. That the Church may serve the poor. Let us pray to the Lord.
2. That the sick may be healed. Let us pray to the Lord.

Father, hear us through Christ our Lord. Amen.`);

  createTemplate({
    title: parsed.title,
    season: 'Christmas',
    fixedDate: '01-14',
    priestInvitation: parsed.priestInvitation,
    responseOptions: parsed.responseOptions,
    intentions: parsed.intentions,
    priestConclusion: parsed.priestConclusion,
  });

  const day = await resolveIso('2027-01-14');
  assert.equal(day.matchedBy, 'calendar date');
  assert.equal(day.template.intentions.length, 2);
  // Stored without the phrases the renderer supplies.
  assert.doesNotMatch(day.template.intentions[0], /let us pray to the lord/i);
  assert.doesNotMatch(day.template.priestConclusion, /amen/i);
});
