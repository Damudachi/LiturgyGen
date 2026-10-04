/**
 * The batch progress stream must carry the access token.
 *
 * This exists because of a silent regression. Progress was
 * `new EventSource('/api/batch/<id>/events')`, which worked until the API grew
 * a gate: EventSource takes no options, so it cannot send an `Authorization`
 * header, and behind `requireAuth` the stream answered 401 before a single
 * frame. A 401 on an EventSource surfaces as an error event with no status, so
 * the console said nothing - the progress bar simply never moved and the
 * "Waiting 173s for the readings source" countdown never appeared.
 *
 * Nothing about that is visible in a build or in any other test, so the guard
 * is on the source itself: the real client may not reach for EventSource, and
 * the stream has to go through the same authenticated path as every other call.
 *
 *   npm run test:client
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const httpApi = fs.readFileSync(path.join(HERE, '..', 'src', 'api', 'httpApi.js'), 'utf8');
const mockApi = fs.readFileSync(path.join(HERE, '..', 'src', 'api', 'mockApi.js'), 'utf8');
const hook = fs.readFileSync(
  path.join(HERE, '..', 'src', 'components', 'calendar', 'useBatchJob.js'),
  'utf8',
);

/** Comments may discuss it; code may not call it. */
function callsEventSource(source) {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .some((line) => /new\s+EventSource/.test(line));
}

test('the real client does not use EventSource, which cannot authenticate', () => {
  assert.equal(callsEventSource(httpApi), false);
});

test('neither does the hook that follows a batch', () => {
  assert.equal(callsEventSource(hook), false);
});

test('the stream is a fetch that sends the auth headers and honours BASE', () => {
  const body = httpApi.slice(httpApi.indexOf('function streamBatch'));
  assert.match(body, /await fetch\(`\$\{BASE\}\/api\/batch\/\$\{id\}\/events`/);
  assert.match(body, /headers: await authHeaders\(false\)/);
});

test('demo mode offers the same function, so the hook has one shape', () => {
  assert.match(httpApi, /\n {2}streamBatch,/);
  assert.match(mockApi, /streamBatch:/);
});
