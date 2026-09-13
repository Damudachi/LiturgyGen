import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDates,
  countLabel,
  datesInMonth,
  removeDate,
  shortcutRequest,
  toggleDate,
} from '../src/lib/selection.js';
import { moveFocus, stripeClass, tileAriaLabel, tileLabel } from '../src/lib/tiles.js';
import { monthGrid } from '../src/lib/dates.js';

test('ticking keeps the selection sorted and unique', () => {
  let selection = [];
  selection = toggleDate(selection, '2026-09-16');
  selection = toggleDate(selection, '2026-09-01');
  selection = addDates(selection, ['2026-09-16', '2026-10-05']);
  assert.deepEqual(selection, ['2026-09-01', '2026-09-16', '2026-10-05']);
  assert.deepEqual(toggleDate(selection, '2026-09-16'), ['2026-09-01', '2026-10-05']);
  assert.deepEqual(removeDate(selection, '2026-10-05'), ['2026-09-01', '2026-09-16']);
});

test('ticks survive changing month and can be read per month', () => {
  const selection = ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01'];
  assert.deepEqual(datesInMonth(selection, 2026, 9), ['2026-09-01', '2026-09-30']);
  assert.deepEqual(datesInMonth(selection, 2026, 10), ['2026-10-01']);
});

test('shortcuts become the server expand request for the month on screen', () => {
  assert.deepEqual(shortcutRequest('mwf', 2026, 9), { year: 2026, month: 9, mode: 'custom', weekdays: [1, 3, 5] });
  assert.deepEqual(shortcutRequest('first-friday', 2026, 9).nthWeekdays, [{ weekday: 5, nth: 1 }]);
  assert.throws(() => shortcutRequest('nope', 2026, 9));
  assert.equal(countLabel(1), '1 day chosen');
  assert.equal(countLabel(22), '22 days chosen');
});

const day = (rank, name, occasionTitle, color = 'GREEN') => ({
  occasionTitle,
  celebration: { rank, name, rankLabel: rank === 'MEMORIAL' ? 'Memorial' : rank, color: { key: color, name: color } },
});

test('tiles name what the day keeps, and plain weekdays say Weekday', () => {
  assert.equal(tileLabel(day('WEEKDAY', 'Wednesday of the 24th week', '24th WEEK IN ORDINARY TIME - WEDNESDAY')), 'Weekday');
  assert.equal(
    tileLabel(day('MEMORIAL', 'Saints Cornelius and Cyprian', 'SAINTS CORNELIUS AND CYPRIAN', 'RED')),
    'Saints Cornelius and Cyprian',
  );
  assert.equal(tileLabel(day('SUNDAY', '24th Sunday', '24th SUNDAY IN ORDINARY TIME')), '24th Sunday in Ordinary Time');
  assert.equal(tileLabel(null), '');
  assert.equal(stripeClass(day('MEMORIAL', 'x', 'X', 'RED')), 'bg-lit-red');
  assert.equal(stripeClass(undefined), 'bg-lit-green');
});

test('the accessible label carries what the colour stripe shows', () => {
  const label = tileAriaLabel(day('MEMORIAL', 'Saints Cornelius and Cyprian', 'SAINTS CORNELIUS AND CYPRIAN', 'RED'), '2026-09-16', { ticked: true });
  assert.match(label, /Wednesday, September 16, 2026/);
  assert.match(label, /Memorial/);
  assert.match(label, /RED/);
  assert.match(label, /chosen$/);
});

test('arrow keys move through real days only', () => {
  const cells = monthGrid(2026, 9); // 1 September 2026 is a Tuesday
  const first = cells.indexOf('2026-09-01');
  assert.equal(moveFocus(cells, first, 'ArrowLeft'), first); // nothing before the 1st
  assert.equal(cells[moveFocus(cells, first, 'ArrowRight')], '2026-09-02');
  assert.equal(cells[moveFocus(cells, first, 'ArrowDown')], '2026-09-08');
  const last = cells.indexOf('2026-09-30');
  assert.equal(moveFocus(cells, last, 'ArrowDown'), last);
  assert.equal(moveFocus(cells, first, 'Enter'), first);
});
