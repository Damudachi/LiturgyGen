/**
 * Checking several days before making them: the answer comes from what is
 * already on hand, and a day never fetched is reported as such - not as a day
 * with its readings missing.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { makeTestDb } from './helpers/pgMem.js';
import { useTestPool } from '../src/db/index.js';

// A throwaway in-process PostgreSQL and no readings cache, so the office's data
// is never touched.
process.env.USCCB_CACHE = 'false';
const { pool } = await makeTestDb({ seed: true });
useTestPool(pool);

const { checkDay } = await import('../src/services/compositionService.js');
const { deleteOverride, peekReadings, saveOverride } = await import('../src/services/scraperService.js');

const DATE = '2099-06-15';

test('a day never fetched is not fetched by the check', async () => {
  assert.equal(await peekReadings(DATE), null);
  const check = await checkDay(DATE, { settings: { usePlaceholderPotf: true } });
  assert.equal(check.fetched, false);
  assert.ok(check.warnings.every((warning) => !/not been fetched/.test(warning)));
});

test('saved readings are checked for their gaps', async () => {
  await saveOverride(
    DATE,
    {
      source: 'manual',
      reading1: { citation: 'Gn 1:1', lines: ['In the beginning'] },
      psalm: { citation: 'Ps 1', refrain: '', stanzas: [['Blessed']] },
      acclamation: { refrain: 'Alleluia', verse: ['Speak, Lord'] },
      gospel: { citation: 'Jn 1:1', lines: ['In the beginning was the Word'] },
    },
    { merge: false },
  );
  try {
    const check = await checkDay(DATE, { settings: { usePlaceholderPotf: true } });
    assert.equal(check.fetched, true);
    assert.equal(check.refetchable, false);
    assert.ok(check.warnings.some((warning) => /no response/.test(warning)));
  } finally {
    await deleteOverride(DATE);
  }
});
