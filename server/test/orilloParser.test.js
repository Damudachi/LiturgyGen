import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrilloPage } from '../src/lib/orilloParser.js';

/** A page typed the way it is printed: heading, invitation, response, five intentions, conclusion. */
const PAGE = `SECOND OF FEBRUARY

The Lord asks us to keep our lamps burning as we wait for him.
With confidence let us bring our needs before the Father.

LORD, HEAR OUR PRAYER.

Or

FATHER, KEEP OUR LAMPS BURNING.

1. That the Church may be a light to the nations. Let us pray to
   the Lord.
2. That leaders of government may govern with justice. Let us pray
   to the Lord.
3. That teachers may hand on the faith with patience. Let us pray to
   the Lord.
4. That the sick may be comforted in their suffering. Let us pray to
   the Lord.
5. That the faithful departed may rest in peace. Let us pray to the
   Lord.

Father, you never fail those who trust in you. Hear the prayers of
your people and bring them to fulfilment through Christ our Lord.
Amen.

47
`;

test('a typed page is split into invitation, responses, intentions and conclusion', () => {
  const parsed = parseOrilloPage(PAGE);

  assert.equal(parsed.title, 'SECOND OF FEBRUARY');
  assert.equal(
    parsed.priestInvitation,
    'The Lord asks us to keep our lamps burning as we wait for him. With confidence let us bring our needs before the Father.',
  );
  assert.deepEqual(parsed.responseOptions, ['LORD, HEAR OUR PRAYER.', 'FATHER, KEEP OUR LAMPS BURNING.']);
  assert.equal(parsed.intentions.length, 5);
  assert.deepEqual(parsed.warnings, []);
});

test('the two phrases the renderer adds back are stripped on the way in', () => {
  const parsed = parseOrilloPage(PAGE);

  for (const intention of parsed.intentions) {
    assert.doesNotMatch(intention, /let us pray to the lord/i, `"${intention}" kept its response`);
  }
  assert.doesNotMatch(parsed.priestConclusion, /amen/i);
  assert.match(parsed.priestConclusion, /through Christ our Lord$/);
});

test('a wrapped intention is joined rather than split into two', () => {
  const parsed = parseOrilloPage(PAGE);
  assert.equal(parsed.intentions[0], 'That the Church may be a light to the nations');
  assert.equal(parsed.intentions[4], 'That the faithful departed may rest in peace');
});

test('a page without an alternative response still parses', () => {
  const parsed = parseOrilloPage(`We turn to the Father in our need.

LORD, HEAR OUR PRAYER.

1. That the Church may be one. Let us pray to the Lord.

Father, hear us through Christ our Lord. Amen.`);

  assert.equal(parsed.title, null);
  assert.deepEqual(parsed.responseOptions, ['LORD, HEAR OUR PRAYER.']);
  assert.deepEqual(parsed.intentions, ['That the Church may be one']);
  assert.equal(parsed.priestConclusion, 'Father, hear us through Christ our Lord');
  assert.deepEqual(parsed.warnings, []);
});

test('a page missing its parts is reported rather than silently accepted', () => {
  const parsed = parseOrilloPage('Just a stray sentence with nothing else.');

  assert.ok(parsed.warnings.some((w) => /response/i.test(w)));
  assert.ok(parsed.warnings.some((w) => /intentions/i.test(w)));
});

test('an empty paste is refused', () => {
  assert.throws(() => parseOrilloPage('   \n\n  '), /Nothing to import/);
});
