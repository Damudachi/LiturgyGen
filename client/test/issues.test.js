import assert from 'node:assert/strict';
import test from 'node:test';
import { datesToFetch, dayStatus, mergeChecks, needsLook, sortByNeed } from '../src/lib/issues.js';

const check = (fetched, warnings = [], refetchable = false) => ({ fetched, warnings, refetchable });

test('a checked day with gaps needs a look before anything is made', () => {
  const status = dayStatus(check(true, ['Responsorial Psalm has no response (R.) - add it manually.']));
  assert.equal(status.state, 'issues');
  assert.equal(needsLook(status), true);
  assert.equal(dayStatus(check(true)).state, 'ok');
});

test('a day never fetched is not called fine, but missing prayers still show', () => {
  assert.equal(dayStatus(check(false)).state, 'unfetched');
  assert.equal(dayStatus(check(false, ['Neither book has Prayers of the Faithful'])).state, 'issues');
  assert.equal(dayStatus(undefined).state, 'unknown');
});

test('a fresh check beats an older run, and a failed run shows its error', () => {
  const fixedSince = dayStatus(check(true), { ok: true, warnings: ['Gospel is missing.'] });
  assert.equal(fixedSince.state, 'ok');
  const failed = dayStatus(check(false), { ok: false, error: 'blocked', warnings: [] });
  assert.equal(failed.state, 'failed');
  assert.deepEqual(failed.messages, ['blocked']);
});

test('days needing a look come first; unfetched and partial fallback days get fetched', () => {
  const checks = mergeChecks({}, [
    { date: '2026-09-01', ...check(true) },
    { date: '2026-09-02', ...check(true, ['Gospel is missing.'], true) },
    { date: '2026-09-03', ...check(false) },
    { date: '2026-09-04', ...check(true, ['Gospel is missing.']) },
  ]);
  const statusOf = (iso) => dayStatus(checks[iso]);
  const dates = Object.keys(checks);
  assert.deepEqual(sortByNeed(dates, statusOf), ['2026-09-02', '2026-09-04', '2026-09-01', '2026-09-03']);
  assert.deepEqual(datesToFetch(dates, statusOf), ['2026-09-02', '2026-09-03']);
});
