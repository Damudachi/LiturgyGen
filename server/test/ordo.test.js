/**
 * The ORDO for the Dioceses of the Philippines, folded in over romcal.
 *
 * romcal is pinned at a 3.0.0-dev build whose Philippines calendar is missing
 * celebrations our printed ORDO keeps. These tests pin what we add and, just as
 * importantly, that an addition yields when the rubrics say it must.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getLiturgicalDay } from '../src/services/calendarService.js';
import { nthWeekdayOfMonth, precedenceRank } from '../src/services/philippineOrdo.js';

test('the Table of Liturgical Days number is read off romcal precedence', () => {
  assert.equal(precedenceRank('TRIDUUM_1'), 1);
  assert.equal(precedenceRank('GENERAL_LORD_FEAST_5'), 5);
  assert.equal(precedenceRank('UNPRIVILEGED_SUNDAY_6'), 6);
  assert.equal(precedenceRank('PRIVILEGED_WEEKDAY_9'), 9);
  assert.equal(precedenceRank('PROPER_MEMORIAL_11B'), 11);
  assert.equal(precedenceRank('WEEKDAY_13'), 13);
  // Nothing recognisable must sort last, never first.
  assert.equal(precedenceRank(undefined), 99);
});

test('the third Sunday of January is found for any year', () => {
  assert.equal(nthWeekdayOfMonth(2026, 1, 0, 3), '2026-01-18');
  assert.equal(nthWeekdayOfMonth(2027, 1, 0, 3), '2027-01-17');
  assert.equal(nthWeekdayOfMonth(2029, 1, 0, 3), '2029-01-21');
});

test('the Santo Nino is kept on the third Sunday of January', async () => {
  for (const [year, iso] of [
    [2026, '2026-01-18'],
    [2027, '2027-01-17'],
    [2029, '2029-01-21'],
  ]) {
    const day = await getLiturgicalDay(iso);
    assert.equal(day.celebration.id, 'santo_nino', `Santo Nino not kept in ${year}`);
    assert.equal(day.celebration.rank, 'FEAST');
    assert.equal(day.occasionTitle, 'THE SANTO NIÑO');
    assert.equal(day.season.name, 'Ordinary Time');
  }
});

test('the Santo Nino displaces the Sunday in Ordinary Time, which stays listed', async () => {
  const day = await getLiturgicalDay('2026-01-18');
  // A Feast of the Lord outranks a Sunday in Ordinary Time, so the Sunday is
  // not kept - but the office should still be able to see what it was.
  assert.ok(day.optionalMemorials.some((entry) => entry.id === 'ordinary_time_2_sunday'));
});

test('an added memorial yields to Lent, Holy Week and the Easter octave', async () => {
  // 2 April falls in Lent or Easter Time every year for a long way out, and a
  // proper memorial ranks below both a Lenten weekday and an octave day.
  for (const [iso, expected] of [
    ['2026-04-02', 'holy_thursday'],
    ['2029-04-02', 'easter_monday'],
    ['2030-04-02', 'lent_4_tuesday'],
  ]) {
    const day = await getLiturgicalDay(iso);
    assert.equal(day.celebration.id, expected);
    // Still offered, so the office can commemorate him.
    assert.ok(
      day.optionalMemorials.some((entry) => entry.id === 'pedro_calungsod_martyr'),
      `Calungsod missing entirely on ${iso}`,
    );
  }
});

test('the ORDO is applied to the Philippines calendar only', async () => {
  const philippines = await getLiturgicalDay('2026-01-18', 'philippines');
  assert.equal(philippines.celebration.id, 'santo_nino');

  // "general" is our point of comparison against the General Roman Calendar,
  // so it must stay untouched by the Philippine ORDO.
  const general = await getLiturgicalDay('2026-01-18', 'general');
  assert.notEqual(general.celebration.id, 'santo_nino');
});

test('an added celebration does not inherit the displaced one', async () => {
  const day = await getLiturgicalDay('2026-01-18');
  assert.equal(day.celebration.name, 'The Santo Niño');
  assert.match(day.celebration.color.name, /White/);
  // The week the day sits in is borrowed on purpose - the Prayers of the
  // Faithful lookup is built from it.
  assert.equal(day.potfLookup.season, 'Feast');
  assert.equal(day.potfLookup.ferialSeason, 'Ordinary Time');
  assert.equal(day.potfLookup.dayOfWeek, 'Sunday');
});

test('days the ORDO says nothing about keep romcal ordering', async () => {
  // A day with several celebrations that no override touches.
  const day = await getLiturgicalDay('2026-09-09');
  assert.equal(day.celebration.id, 'ordinary_time_23_wednesday');
  assert.deepEqual(
    day.optionalMemorials.map((entry) => entry.id),
    ['peter_claver_priest'],
  );
});

test('inserting into a day does not reorder what romcal put there', async () => {
  // romcal's order is not a plain precedence sort: on Holy Thursday it lists
  // the day (precedence 9) ahead of the Mass of the Lord's Supper (precedence
  // 1). In 2026 that is also 2 April, so Calungsod is inserted here - and
  // sorting the day instead of inserting into it cost Holy Thursday its prayer.
  const day = await getLiturgicalDay('2026-04-02');
  assert.equal(day.celebration.id, 'holy_thursday');
  assert.ok(day.optionalMemorials.some((entry) => entry.id === 'thursday_of_the_lords_supper'));
  assert.ok(day.optionalMemorials.some((entry) => entry.id === 'pedro_calungsod_martyr'));
});
