/**
 * Repair OCR damage in the office's Orillo transcriptions.
 *
 * The transcriptions were extracted from a two-column printed page. Where the
 * extractor mis-detected the column boundary it spliced text from the facing
 * column into the middle of a prayer, and it rendered some ligatures as high
 * Latin-1 characters. This tool fixes only what is mechanically certain and
 * routes everything else to a worksheet for someone to retype from the book.
 *
 * NO PRAYER TEXT LIVES IN THIS FILE. The rules below are substitution rules;
 * the text they apply to stays in server/data/orillo/, which is gitignored.
 * Keep it that way - the repository carries the code, never the book.
 *
 *   node server/tools/repair-orillo-ocr.mjs ordinary-time          # dry run
 *   node server/tools/repair-orillo-ocr.mjs ordinary-time --write  # apply
 *
 * --write rewrites the section file in place, keeping a .bak beside it, and
 * writes _worksheet-<section>.md next to it listing what it could not fix.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTrailingAmen } from '../src/lib/orilloParser.js';

const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/orillo',
);

/* ------------------------------------------------------------------ tier 1 */

/**
 * Ligatures the extractor emitted as high Latin-1. Each mapping below was
 * confirmed against every occurrence in the file, not assumed:
 *   'ti' covers continue/promptings/executive/nations/Christian/victims/...
 *   'w'  covers whatever/wisdom/who/known/with
 *   'Le' covers the "Let us" that opens an invitation
 * The em dash is REAL punctuation on the printed page and is left alone.
 */
const LIGATURES = [
  [/ü/g, 'ti'],
  [/»/g, 'w'],
  [/ß/g, 'Le'],
  [/é/g, 'e'],
];

/**
 * Characters whose expansion varies by word, so no global rule is safe.
 * Their prayers go to the worksheet instead.
 */
const AMBIGUOUS = /[€åÅæ]/;

/** Word-level errors with exactly one possible reading. */
const WORDS = [
  [/\bArnen\b/g, 'Amen'],
  [/\bcondnue\b/g, 'continue'],
  [/\b[fI]irough\b/g, 'Through'],
  [/\bIhrough\b/g, 'Through'],
  [/\bNmighty\b/g, 'Almighty'],
  [/\b12t\b/g, 'Let'],
  [/\bofyour\b/g, 'of your'],
  [/\boftheir\b/g, 'of their'],
  [/\bofJesus\b/g, 'of Jesus'],
  [/\bourFather\b/g, 'our Father'],
  [/\bOflove\b/g, 'of love'],
  [/\baskthisthrough\b/g, 'ask this through'],
  [/\bChristour\b/g, 'Christ our'],
  [/\bourLord\b/g, 'our Lord'],
  [/\beardl\b/g, 'earth'],
  [/\bdie Gospel\b/g, 'the Gospel'],
  [/\bevemvhere\b/g, 'everywhere'],
  [/\bfootstevjs\b/g, 'footsteps'],
  [/\baithifl\b/g, 'faithful'],
  [/\bgroq\b/g, 'grows'],
  [/\bGodour\b/g, 'God our'],
  [/\bInving\b/g, 'Loving'],
  // spacing: a period glued to the next sentence
  [/([a-z])\.([A-Z])/g, '$1. $2'],
];

/**
 * How a concluding prayer opens. Used to find where the real conclusion starts
 * so that text spliced in ahead of it can be lifted out. Damaged spellings are
 * included because the opener itself is sometimes what got mangled.
 */
const INVOCATION = new RegExp(
  '(?:' +
    [
      'Heavenly Father', 'Almighty Father', 'Almighty God', 'Eternal Father',
      'Merciful Father', 'Most gentle', 'Lord God', 'Lord Jesus', 'Lord of',
      'Lord our', 'Lord, ', 'God our', 'God Our', 'God of', 'God Of',
      'God and', 'God, you', 'Father of', 'Father in', 'Father all',
      'Father, ', 'Father a', 'O Lord', 'Grd, ', 'L\\)rd ', 'Almighty',
      'Loving God', 'Loving Father',
    ].join('|') +
  ')',
);

/**
 * The rubric the renderer appends to every intention. orilloParser exports a
 * stripper for the TRAILING copy; this one also catches the copies the column
 * bleed left in the middle of a conclusion, which is where they must not be.
 */
const RUBRIC = /\s*Let us pray to the Lord\.?\s*/gi;

/* ------------------------------------------------------------------ passes */

function applyRules(text, rules) {
  let out = text;
  for (const [re, to] of rules) out = out.replace(re, to);
  return out;
}

/**
 * Split a conclusion into the prayer itself and any column bleed around it.
 * Bleed ahead of the invocation is the tail of the last intention; bleed after
 * the closing "Amen." is the head of the next page's column. Both are kept so
 * the worksheet can show them - they are the only copy the office has.
 */
function splitConclusion(text) {
  let lead = '';
  let body = text.trim();

  const at = body.search(INVOCATION);
  if (at > 0) {
    lead = body.slice(0, at).trim();
    body = body.slice(at).trim();
  }

  // The prayer ends at its doxology; anything past that is the next column.
  // A conclusion may also OPEN with "Father of our Lord Jesus Christ...", so a
  // doxology this early in the text is part of the invocation, not the ending.
  // Take the first candidate that leaves a plausible prayer behind it.
  const MIN_BODY = 60;
  let tail = '';
  const end = /(?:(?:for ?)?ever and ever|now and for ?ever|through (?:the same )?Christ our Lord|by the (?:strength|power) of Jesus Christ our Lord|in the name of Jesus Christ our Lord|of Jesus Christ our Lord|Jesus Christ our Lord|our Lord)[\s,.]*(?:Amen\.?)?/gi;
  for (const m of body.matchAll(end)) {
    const stop = m.index + m[0].length;
    if (stop < MIN_BODY) continue;
    if (stop < body.length) tail = body.slice(stop).trim();
    body = body.slice(0, stop).trim();
    break;
  }

  return { lead, body, tail };
}

function repairPrayer(p, flags) {
  const id = `W${p.week} ${p.dayOfWeek}`;
  const note = (kind, detail) => flags.push({ id, kind, detail });
  const out = { ...p };
  const fix = (s) => applyRules(applyRules(s, LIGATURES), WORDS);

  for (const k of ['priestInvitation', 'priestConclusion']) {
    if (AMBIGUOUS.test(p[k])) note('ambiguous ligature', `${k}: ${p[k].match(AMBIGUOUS)[0]}`);
    out[k] = fix(p[k]);
  }
  out.intentions = p.intentions.map((t, i) => {
    if (AMBIGUOUS.test(t)) note('ambiguous ligature', `intention ${i + 1}: ${t.match(AMBIGUOUS)[0]}`);
    return fix(t);
  });
  out.responseOptions = p.responseOptions.map(fix);

  // Conventions: the renderer supplies the rubric and the Amen.
  const { lead, body, tail } = splitConclusion(out.priestConclusion);
  const concl = body.replace(RUBRIC, ' ').replace(/\s+/g, ' ').trim();
  out.priestConclusion = stripTrailingAmen(concl).trim();

  if (lead) note('bleed before conclusion', lead);
  if (tail) note('bleed after conclusion', tail);

  out.intentions = out.intentions.map((t) =>
    t.replace(RUBRIC, ' ').replace(/\s+/g, ' ').trim(),
  );

  // What still needs a human and the book.
  if (!/[.!?:"]$/.test(out.priestInvitation.trim())) {
    note('invitation truncated', out.priestInvitation);
  }
  if (out.priestInvitation.trim().length < 40) {
    note('invitation too short to be whole', out.priestInvitation);
  }
  if (!INVOCATION.test(out.priestConclusion)) {
    note('conclusion has no invocation', out.priestConclusion);
  }
  // Safety net: if the renderer's own phrases survived the split, the text was
  // too scrambled for the doxology to be found and a human has to place it.
  if (/\bAmen\b/i.test(out.priestConclusion) || /Let us pray to the Lord/i.test(out.priestConclusion)) {
    note('conclusion still holds an Amen or rubric - ending not located', out.priestConclusion);
  }
  out.intentions.forEach((t, i) => {
    if (t.length < 30) note('intention too short', `#${i + 1}: ${t}`);
    if (/(?:^|\s)\d\.\s/.test(t)) note('numbering inside intention', `#${i + 1}: ${t}`);
  });

  const scan = {
    priestInvitation: out.priestInvitation,
    priestConclusion: out.priestConclusion,
  };
  out.intentions.forEach((t, i) => { scan[`intention ${i + 1}`] = t; });
  for (const [k, v] of Object.entries(scan)) {
    const glue = v.match(/\b\w*[a-z][A-Z]\w*\b|\b[a-z]{15,}\b/g);
    if (glue) note('possible glued words', `${k}: ${[...new Set(glue)].join(', ')}`);
    const orphan = v.match(/(?:^|\s)[b-hj-z](?=\s)/g);
    if (orphan) note('orphan letter', `${k}: ${v.slice(0, 90)}`);
    const digit = v.match(/\b\w*(?:[A-Za-z]\d|\d[A-Za-z])\w*\b/g);
    if (digit) note('digit inside word', `${k}: ${[...new Set(digit)].join(', ')}`);
  }

  return out;
}

/* ------------------------------------------------------------------- entry */

const section = process.argv[2];
const write = process.argv.includes('--write');
if (!section) {
  console.error('usage: repair-orillo-ocr.mjs <section> [--write]');
  process.exit(2);
}

const file = path.join(DATA_DIR, `${section}.json`);
if (!fs.existsSync(file)) {
  console.error(`${file} is not on this machine.`);
  process.exit(2);
}

const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const flags = [];
const before = JSON.stringify(doc.prayers);
doc.prayers = doc.prayers.map((p) => repairPrayer(p, flags));
const changed = before !== JSON.stringify(doc.prayers);

const byPrayer = new Map();
for (const f of flags) {
  if (!byPrayer.has(f.id)) byPrayer.set(f.id, []);
  byPrayer.get(f.id).push(f);
}

const kinds = {};
for (const f of flags) kinds[f.kind] = (kinds[f.kind] || 0) + 1;

console.log(`${section}: ${doc.prayers.length} prayers, text ${changed ? 'changed' : 'unchanged'}`);
console.log(`flagged for manual retyping: ${byPrayer.size} prayers, ${flags.length} findings`);
for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

if (write) {
  fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${file} (backup at ${path.basename(file)}.bak)`);

  const lines = [
    `# Retyping worksheet - ${doc.section}`,
    '',
    'Machine-fixable OCR damage has already been corrected in the JSON. What is',
    'listed here lost characters in extraction and cannot be recovered from the',
    'file, so it needs checking against the printed page.',
    '',
    '"Bleed" is text the extractor lifted from the facing column. It has been',
    'taken out of the conclusion where it did not belong; it is reproduced here',
    'because this is the only copy, and it usually belongs to intention 5 of the',
    'same day or to the prayer on the facing page.',
    '',
    `Generated by server/tools/repair-orillo-ocr.mjs. ${byPrayer.size} of ${doc.prayers.length} prayers need attention.`,
    '',
  ];
  for (const [id, found] of byPrayer) {
    lines.push(`## ${id}`, '');
    for (const f of found) lines.push(`- **${f.kind}** - ${f.detail}`);
    lines.push('');
  }
  const ws = path.join(DATA_DIR, `_worksheet-${section}.md`);
  fs.writeFileSync(ws, lines.join('\n'), 'utf8');
  console.log(`wrote ${ws}`);
} else {
  console.log('\ndry run - nothing written. pass --write to apply.');
}
