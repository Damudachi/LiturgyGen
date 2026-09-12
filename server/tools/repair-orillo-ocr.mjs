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

/** Sections in the order the book prints them, as orillo.seed.js has them. */
const SECTIONS = ['advent', 'christmas', 'lent', 'easter', 'solemnities', 'ordinary-time'];

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

/**
 * The Lent and Easter sections failed differently from Ordinary Time: instead
 * of dropping characters the extractor dropped the SPACES, collapsing whole
 * lines into one token ("LORD,HEAROURPRAYER"). Those are recoverable, but only
 * against a vocabulary - so the vocabulary is built from the corpus itself,
 * from the tokens that came through the other sections correctly spaced. A
 * collapsed run is only split when every piece is a word the book actually
 * uses; anything else is left alone and flagged.
 */
function tokensOf(sections) {
  const vocab = new Map();
  for (const section of sections) {
    const file = path.join(DATA_DIR, `${section}.json`);
    if (!fs.existsSync(file)) continue;
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const p of doc.prayers ?? []) {
      const text = [
        p.priestInvitation, p.priestConclusion,
        ...(p.intentions ?? []), ...(p.responseOptions ?? []),
      ].join(' ');
      for (const w of text.match(/[A-Za-z]+/g) ?? []) {
        const k = w.toLowerCase();
        vocab.set(k, (vocab.get(k) ?? 0) + 1);
      }
    }
  }
  return vocab;
}

/**
 * The vocabulary that vouches for a word, and supplies the pieces of a split.
 *
 * A section cannot vouch for its own damage: if Lent's "ourfather" counts as a
 * word, the splitter happily "recognises" the very run it is meant to take
 * apart. So the target section is excluded, and so are Lent and Easter, whose
 * collapsed lines would otherwise be learned as vocabulary by each other.
 */
function vouchingVocabulary(target) {
  const vocab = tokensOf(
    SECTIONS.filter((s) => s !== target && s !== 'lent' && s !== 'easter'),
  );

  // Even those sections carry a little glue ("Thatthe", "inyour"), and a glued
  // token in the vocabulary vouches for the very thing we are splitting. Drop
  // any uncommon token that comes apart into words far more common than it is;
  // a real compound ("everlasting") has no such decomposition.
  const suspect = [];
  for (const [word, count] of vocab) {
    if (word.length < 6 || count > 3) continue;
    for (let i = 2; i <= word.length - 2; i += 1) {
      const [a, b] = [word.slice(0, i), word.slice(i)];
      if ((vocab.get(a) ?? 0) >= 10 && (vocab.get(b) ?? 0) >= 10) {
        suspect.push(word);
        break;
      }
    }
  }
  for (const word of suspect) vocab.delete(word);
  return vocab;
}

/** Single letters the book uses as words: the vocative "O", "a", "I". */
const SINGLES = new Set(['a', 'i', 'o']);

/**
 * The short words that are genuinely words. Anything else of one or two
 * letters in a proposed split is a shard of a word the vocabulary is missing
 * ("a lie na ted" for "alienated"), which is the failure mode to guard against.
 */
const SHORT_WORDS = new Set([
  'a', 'i', 'o', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if',
  'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up',
  'us', 'we',
]);

/** Set by the entry point once the target section is known. */
let VOCAB = new Map();

const known = (w) => (w.length === 1 ? SINGLES.has(w) : VOCAB.has(w));

/**
 * Would this piece stand as a word on its own? A short piece has to be on the
 * list above; a longer one has to have been seen twice, since a token that
 * appears exactly once is as likely to be another collapsed run as a word.
 */
const solidPiece = (w) => {
  // A lone letter is only a word where the book wrote it as one - the vocative
  // "O Lord", "I". Lower case, it is the tail of a word the vocabulary is
  // missing, as in "protect i on".
  if (w.length === 1) return /[AIO]/.test(w);
  if (w.length === 2) return SHORT_WORDS.has(w.toLowerCase());
  return (VOCAB.get(w.toLowerCase()) ?? 0) >= 2;
};

/**
 * Total token count, for turning vocabulary counts into probabilities.
 * Recomputed whenever the vocabulary is set.
 */
let VOCAB_TOTAL = 1;

/**
 * How likely this word is, as a log probability. Scoring a split by the sum of
 * these picks the reading the book itself makes most often, which is what
 * settles the cases length alone gets wrong: "your son" beats "yours on"
 * because "your" and "son" are common here and "yours" is not, and "that the"
 * beats the glued "thatthe" for the same reason.
 */
const logProbability = (w) =>
  Math.log((VOCAB.get(w.toLowerCase()) ?? 0.5) / VOCAB_TOTAL);

/**
 * Split a run of letters into corpus words, or return null when it cannot be
 * done cleanly.
 */
function segment(run) {
  const s = run.toLowerCase();
  const n = s.length;
  const best = new Array(n + 1).fill(-Infinity);
  const from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 0; i < n; i += 1) {
    if (best[i] === -Infinity) continue;
    for (let j = i + 1; j <= n; j += 1) {
      // A piece may never be the whole run: that is the case we are splitting.
      if (i === 0 && j === n) continue;
      const w = s.slice(i, j);
      if (!known(w)) continue;
      // A flat cost per word keeps the split from buying cheap extra pieces
      // out of very common short words - without it "in to" edges out "into",
      // which is a real reading only because "in" and "to" are everywhere. A
      // single letter is penalised further still, so that a word missing from
      // the vocabulary is never patched over with stray letters ("i sin").
      const score = best[i] + logProbability(w) - 1 - (w.length === 1 ? 8 : 0);
      if (score > best[j]) {
        best[j] = score;
        from[j] = i;
      }
    }
  }
  if (best[n] === -Infinity) return null;
  const cuts = [];
  for (let i = n; i > 0; i = from[i]) cuts.unshift(i);
  cuts.unshift(0);
  if (cuts.length - 1 < 2) return null; // not actually two words
  // Slice the ORIGINAL so capitalisation survives untouched.
  return cuts.slice(0, -1).map((start, i) => run.slice(start, cuts[i + 1]));
}

/**
 * Is this run worth trying to split at all?
 *  - An internal capital ("ourFather", "intheKingdom") is decisive: no English
 *    word carries one, so the run is certainly two words run together.
 *  - Otherwise the run has to be long enough to be a collapsed line AND
 *    unvouched-for by the undamaged sections.
 */
function looksCollapsed(run) {
  if (/[a-z][A-Z]/.test(run)) return true;
  // Thirteen, not ten: at ten this starts shredding ordinary words that the
  // vouching sections happen not to use - "protection", "indwelling" - and a
  // plausible-looking wrong word in a prayer is worse than one left flagged.
  if (run.length < 13) return false;
  return !VOCAB.has(run.toLowerCase());
}

/**
 * Every split this tool makes, as `run -> result`, so that --explain can show
 * its work. A wrong split corrupts a prayer silently, so the decisions are
 * reviewable rather than implicit.
 */
const SPLITS = new Map();

/**
 * Expand the collapsed runs in a string.
 *
 * A split is only written into the prayer when every piece stands on its own
 * as a word. Where it does not, the guess goes to the worksheet as a
 * suggestion and the text is left exactly as it was: a wrong split reads as
 * real text and would be prayed aloud, whereas a run left collapsed is
 * obviously broken and gets retyped.
 */
function unglue(text, note) {
  return text.replace(/[A-Za-z]{8,}/g, (run) => {
    if (!looksCollapsed(run)) return run;
    const parts = segment(run);
    if (!parts) {
      note('collapsed run could not be split', run);
      return run;
    }
    const joined = parts.join(' ');
    if (!parts.every(solidPiece)) {
      const weak = parts.filter((w) => !solidPiece(w)).join(', ');
      note('collapsed run - check this split by hand', `${run} -> ${joined}  (unsure: ${weak})`);
      return run;
    }
    SPLITS.set(run, joined);
    return joined;
  });
}

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
  // Short glue the splitter will not touch: it only considers runs of eight
  // letters or more, and no English word is "inthe" or "tothe" anyway.
  [/\binthe\b/gi, 'in the'],
  [/\btothe\b/gi, 'to the'],
  [/\bofthe\b/gi, 'of the'],
  [/\bandthe\b/gi, 'and the'],
  [/\bthatwe\b/gi, 'that we'],
  [/\bwemay\b/gi, 'we may'],
  // spacing: a period or comma glued to what follows it
  [/([a-z])\.([A-Z])/g, '$1. $2'],
  [/([a-z]),([A-Za-z])/g, '$1, $2'],
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
      'Loving God', 'Loving Father', 'Gracious Father', 'Gentle Father',
      'Holy Father', 'All powerful', 'Almighty and', 'O God',
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
  // Ordinary Time is identified by week and weekday; the seasons name their
  // days instead ("Thursday after Ash Wednesday"), so the title is the label
  // that works for every section.
  const id = (p.title ?? `W${p.week} ${p.dayOfWeek}`).replace(/\s*\(Orillo\)\s*$/, '');
  const note = (kind, detail) => flags.push({ id, kind, detail });
  const out = { ...p };
  const fix = (s) => unglue(applyRules(applyRules(s, LIGATURES), WORDS), note);

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

VOCAB = vouchingVocabulary(section);
VOCAB_TOTAL = [...VOCAB.values()].reduce((a, b) => a + b, 0) || 1;

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

if (process.argv.includes('--explain')) {
  console.log(`\ncollapsed runs split apart (${SPLITS.size}) - check each one:`);
  for (const [run, joined] of [...SPLITS].sort()) {
    console.log(`  ${run}\n    -> ${joined}`);
  }
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
