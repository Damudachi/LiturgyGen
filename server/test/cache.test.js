/**
 * Cache reuse rules. The bug these pin down: a day fetched from the fallback
 * while USCCB was blocking us stayed cached without its psalm response and
 * Gospel Acclamation, and was never re-fetched.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { canServeFromCache } from '../src/services/scraperService.js';

const complete = {
  reading1: { lines: ['a'] },
  psalm: { refrain: 'R.', stanzas: [['a']] },
  acclamation: { verse: ['a'] },
  gospel: { lines: ['a'] },
};

test('a complete day is served from cache whoever fetched it', () => {
  assert.equal(canServeFromCache({ ...complete, source: 'usccb' }, 'usccb'), true);
  assert.equal(canServeFromCache({ ...complete, source: 'evangelizo' }, 'usccb'), true);
});

test('a partial day from the fallback is re-fetched, not served', () => {
  const partial = { ...complete, psalm: { refrain: '', stanzas: [['a']] }, acclamation: null };
  assert.equal(canServeFromCache({ ...partial, source: 'evangelizo' }, 'usccb'), false);
});

test('a partial day from the preferred source is accepted as the day itself', () => {
  // Good Friday genuinely has no Gospel Acclamation; re-fetching would never help.
  const partial = { ...complete, acclamation: null };
  assert.equal(canServeFromCache({ ...partial, source: 'usccb' }, 'usccb'), true);
  assert.equal(canServeFromCache({ ...partial, source: 'usccb (imported)' }, 'usccb'), true);
});

test('nothing cached means nothing to serve', () => {
  assert.equal(canServeFromCache(null, 'usccb'), false);
});

/**
 * The bot-check circuit breaker. USCCB's block is a state, not a per-request
 * verdict: asking again while it is up renews it. A 30-date batch used to do
 * exactly that, so one challenge on date 2 pushed dates 3-30 onto the fallback
 * feed - which carries no psalm response and no Gospel Acclamation.
 */

import usccb, {
  absorbCookies,
  challengeCooldownMs,
  closeChallengeCooldown,
  cookieHeader,
  openChallengeCooldown,
} from '../src/services/providers/usccbProvider.js';

test('a bot check opens a cooldown, and being served again closes it', () => {
  closeChallengeCooldown();
  assert.equal(challengeCooldownMs(), 0);

  openChallengeCooldown();
  assert.ok(challengeCooldownMs() > 0, 'the cooldown should be running');

  closeChallengeCooldown();
  assert.equal(challengeCooldownMs(), 0);
});

test('the cooldown counts down and lets a probe through once it lapses', () => {
  const now = Date.now();
  openChallengeCooldown(now);
  assert.ok(challengeCooldownMs(now + 1000) < challengeCooldownMs(now));
  assert.equal(challengeCooldownMs(now + 60 * 60 * 1000), 0);
  closeChallengeCooldown();
});

test('while the cooldown runs, USCCB is not asked at all', async () => {
  openChallengeCooldown();
  // 1 January 2099 is not in the raw-page cache, so a request would have to go
  // out. It must not: the whole point is to stop renewing the block.
  await assert.rejects(
    () => usccb.fetchHtml('2099-01-01'),
    (error) => error.code === 'USCCB_CHALLENGE' && error.cooldownMs > 0,
  );
  closeChallengeCooldown();
});

/**
 * The cookie jar. USCCB issues a short-lived grace cookie with a page it agrees
 * to serve; returning it is what lets the next date through. Dropping it made
 * every request after the first look like an unverified first-time visitor.
 */

test('cookies USCCB sets are kept and sent back on the next request', () => {
  usccb.clearCookies();
  assert.equal(cookieHeader(), '');

  absorbCookies({
    headers: {
      'set-cookie': [
        'X_Obolus_Grace=1788686471:cf5d01bf; Path=/; HttpOnly; SameSite=Lax',
        'CFID=99; Path=/',
      ],
    },
  });

  assert.equal(cookieHeader(), 'X_Obolus_Grace=1788686471:cf5d01bf; CFID=99');
});

test('a re-issued cookie replaces the stale one rather than piling up', () => {
  usccb.clearCookies();
  absorbCookies({ headers: { 'set-cookie': ['X_Obolus_Grace=old; Path=/'] } });
  absorbCookies({ headers: { 'set-cookie': ['X_Obolus_Grace=fresh; Path=/'] } });
  assert.equal(cookieHeader(), 'X_Obolus_Grace=fresh');
  usccb.clearCookies();
});

test('a response with no cookies is handled without throwing', () => {
  usccb.clearCookies();
  absorbCookies({ headers: {} });
  absorbCookies({});
  absorbCookies(undefined);
  assert.equal(cookieHeader(), '');
});
