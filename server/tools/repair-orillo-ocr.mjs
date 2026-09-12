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
  // The extractor opened a quotation with a curly mark and closed it with a
  // straight one. The rest of the corpus is straight throughout.
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
];

/**
 * These four characters stand for a different string in nearly every word
 * they appear in - the "å" of "naåons" is "ti", of "åe" is "th", of
 * "proclåmers" is "ai" - so there is no character rule to write. There are
 * only twelve of them in the whole corpus, and context fixes each one, so
 * they are listed as whole tokens and replaced before the character pass.
 */
const AMBIGUOUS_TOKENS = [
  [/1Å\)rd/g, 'Lord'],
  [/»Åth/g, 'with'],
  [/»\.?€ith/g, 'with'],
  [/»åtness/g, 'witness'],
  [/proclåmers/g, 'proclaimers'],
  [/naåons/g, 'nations'],
  // Not \b: a word boundary needs a word character on one side, and "å" is
  // not one, so /\båe\b/ never matches at all.
  [/åe(?![A-Za-z])/g, 'the'],
  [/cidæns/g, 'citizens'],
  [/Chris€ans/g, 'Christians'],
  [/pray€/g, 'prayer'],
];

/** Any of those four left over after the list above has run. */
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
  // Seeded last so the pruning above cannot take them back out.
  for (const word of KNOWN_WORDS) vocab.set(word, Math.max(vocab.get(word) ?? 0, 4));
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
  // An internal capital, or a long run the vouching sections do not know, is
  // real evidence of collapse - worth reporting when it cannot be split.
  if (/[a-z][A-Z]/.test(run)) return 'evident';
  if (VOCAB.has(run.toLowerCase())) return false;
  if (run.length >= 13) return 'evident';
  // Ten to twelve letters is not evidence of anything: most such runs are
  // ordinary words the vouching sections merely happen not to use. Try a
  // split, but say nothing when there isn't one - flagging these buries the
  // real findings under hundreds of false ones.
  if (run.length >= 10) return 'speculative';
  return false;
}

/**
 * Every split this tool makes, as `run -> result`, so that --explain can show
 * its work. A wrong split corrupts a prayer silently, so the decisions are
 * reviewable rather than implicit.
 */
const SPLITS = new Map();

/** Every intention put back together, for --explain to show. */
const REJOINED = [];

/**
 * Rubric debris: what is left of "Let us pray to the Lord." once the extractor
 * has chewed the front off it. Carries no words of its own.
 */
const DEBRIS = /^(?:[a-z]{1,3}\s+)?(?:us\s+)?(?:pray\s+)?(?:to\s+)?(?:the\s+)?(?:Lord|Los)?[.,;:]?$/i;

/**
 * Does this read as running prose rather than extraction rubble? Rubble is
 * recognisable by stray single letters and digits mixed into words ("n e to do
 * younill", "b filg"), which never occur in the printed prayers.
 */
function looksLikeProse(s) {
  if (s.length < 3) return false;
  if (/\d/.test(s)) return false;
  if (/[()|$~^{}\\]/.test(s)) return false;
  const words = s.split(/\s+/);
  const singles = words.filter((w) => /^[A-Za-z]$/.test(w) && !/^[AIO]$/.test(w));
  return singles.length === 0;
}

/**
 * The extractor lifted the end of the last intention into the front of the
 * conclusion. Put it back, but only where the join is unambiguous: the stored
 * intention has to be visibly unfinished, and the fragment has to read as
 * prose that closes a sentence. Everything else is left for the worksheet,
 * because a wrongly rejoined intention is read aloud as if it were the book.
 */
function reattachLead(out, lead, id, note) {
  const cleaned = lead.replace(RUBRIC, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || DEBRIS.test(cleaned)) return; // nothing but rubric remnants
  const last = out.intentions.length - 1;
  const stored = out.intentions[last];

  // Sometimes the whole numbered intention came across, not just its tail.
  // The number is sometimes followed by a comma rather than a full stop.
  const numbered = cleaned.match(/^(\d)[.,]\s*(That\b[\s\S]*)$/);
  if (numbered) {
    const text = numbered[2].replace(RUBRIC, ' ').replace(/\s+/g, ' ').trim();
    if (/\d\.\s+That/.test(text)) {
      note('bleed holds more than one intention', cleaned);
      return;
    }
    if (!looksLikeProse(text) || !/[.!?"]$/.test(text)) {
      note('bleed holds a damaged intention', cleaned);
      return;
    }
    if (text.length > stored.length) {
      REJOINED.push(`${id} int${last + 1}: [replaced] ${stored}  ==>  ${text}`);
      out.intentions[last] = text;
    } else {
      note('bleed repeats an intention already stored', cleaned);
    }
    return;
  }

  if (/[.!?"]$/.test(stored)) {
    note('bleed before conclusion, intention already complete', cleaned);
    return;
  }
  if (!looksLikeProse(cleaned) || !/[.!?"]$/.test(cleaned)) {
    note('bleed before conclusion, too damaged to rejoin', cleaned);
    return;
  }
  REJOINED.push(`${id} int${last + 1}: ${stored}  +  ${cleaned}`);
  out.intentions[last] = `${stored} ${cleaned}`;
}

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
    // The curated list handles this one on the pass after this, so neither
    // split it here nor report it as unsplittable.
    if (GLUED_PAIRS[run]) return run;
    const evidence = looksCollapsed(run);
    if (!evidence) return run;
    const speculative = evidence === 'speculative';
    const report = (kind, detail) => {
      if (!speculative) note(kind, detail);
    };

    const parts = segment(run);
    if (!parts) {
      report('collapsed run could not be split', run);
      return run;
    }
    // Splitting a ten-letter word in two is how "protection" becomes
    // "protect on" and "workplaces" becomes "work places". Three or more
    // pieces is evidence of a collapsed line rather than a word, so demand
    // that before touching anything the length alone does not condemn.
    if (speculative && parts.length < 3) {
      return run;
    }
    const joined = parts.join(' ');
    if (!parts.every(solidPiece)) {
      const weak = parts.filter((w) => !solidPiece(w)).join(', ');
      report('collapsed run - check this split by hand', `${run} -> ${joined}  (unsure: ${weak})`);
      return run;
    }
    SPLITS.set(run, joined);
    return joined;
  });
}

/**
 * Two words run together, short enough that the splitter will not risk them.
 * Below thirteen letters a two-piece split is as likely to be an ordinary word
 * as a collapsed line, so these are curated by hand rather than computed.
 *
 * THE RULES ARE NOT IN THIS REPOSITORY. Each one pairs a mangled run with the
 * words it stands for, so the replacements are short fragments of the printed
 * prayers - the book's text, which this repository must never carry. They live
 * beside the transcriptions instead:
 *
 *   server/data/orillo/_repair-rules.json      (gitignored)
 *
 * A checkout without that file still runs: the runs it would have mended are
 * reported in the worksheet as unsplittable, and nothing is silently skipped.
 */
function loadCuratedRules() {
  const file = path.join(DATA_DIR, '_repair-rules.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).gluedPairs ?? {};
  } catch (cause) {
    throw new Error(`${file} is not valid JSON.`, { cause });
  }
}

const GLUED_PAIRS = loadCuratedRules();

/**
 * Applied last, after the splitting, because the splitting is what produces
 * these: a collapsed line was set in small capitals on the page and came out
 * of the extractor in lower case, so the proper nouns inside it lose their
 * capitals the moment the line is broken back into words.
 */
const AFTER_SPLIT = [
  [/\bjesus\b/g, 'Jesus'],
  [/\bchrist\b/g, 'Christ'],
  [/\blord\b/g, 'Lord'],
  // A vocative needs its comma back: "of Jesus Father, hear us".
  [/\bJesus [Ff]ather\b/g, 'Jesus, Father'],
  // "die" is a word the prayers use ("to die to self"), so it is only
  // corrected where the sense is plainly "the".
  [/\bdie banquet\b/g, 'the banquet'],
];

/**
 * Ordinary words that the vouching sections happen not to use, which the
 * splitter would therefore treat as collapsed lines - it offered "under
 * privileged", "transform at ion" and "protect on" for these. Seeding them as
 * vocabulary settles it: they are words, so they are left alone and not
 * reported.
 */
const KNOWN_WORDS = [
  'alienated', 'becoming', 'beside', 'cannot', 'compromise', 'contemplating',
  'encouragement', 'enlightenment', 'illnesses', 'indwelling', 'inhuman',
  'injustice', 'lingering', 'meritoriously', 'mourning', 'nowhere', 'passion',
  'pathway', 'privileged', 'protection', 'reconciliation', 'reconciliations',
  'responsibilities', 'righteousness', 'thirst', 'transformation',
  'uncertainties', 'underprivileged', 'understanding', 'whenever',
  'workplaces',
  // Long words the vouching sections do not happen to contain, which were
  // being reported as unsplittable runs when they are simply words.
  'communicating', 'compassionate', 'consideration', 'contradiction',
  'disadvantaged', 'discrimination', 'opportunities', 'organizations',
  'respectability', 'supplications',
];

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
  [/\binvitadon\b/g, 'invitation'],
  [/\bffe\b/g, 'the'],
  [/\bGouour\b/g, 'God our'],
  [/\byouoy\b/g, 'your only'],
  [/\bFatheraJJ\b/g, 'Father all'],
  [/\bIor\b/g, 'Lord'],
  [/\bIord\b/g, 'Lord'],
  [/\baplace\b/g, 'a place'],
  [/\bUsin\b/g, 'Us in'],
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

/**
 * What is left of that rubric when the extractor cut it off part way - a bare
 * "Let", "Let us", "us pray to the Lord". At the end of an intention none of
 * these is ever the book's own words, so they come off.
 */
const RUBRIC_REMNANT =
  /[\s,]*\b(?:Let(?:\s+us(?:\s+pray(?:\s+to(?:\s+the(?:\s+Lord)?)?)?)?)?|us\s+pray(?:\s+to(?:\s+the(?:\s+Lord)?)?)?|pray\s+to\s+the\s+Lord)\s*\.?\s*$/i;

/**
 * Tails that carry no words of the prayer: the "Amen." the extractor dragged
 * over, a doxology already present in the conclusion, a running header, or a
 * page number. Reporting these sends someone to the book for nothing.
 */
const TAIL_DEBRIS = new RegExp(
  '^(?:' +
    [
      '[A-Za-z]{0,2}', // A, An, e, I, II, L6 and other scraps
      'Arne|Arr|Amel|Amen\\.?',
      '[0-9IlO]{1,4}', // page numbers read as letters
      '(?:s\\s+)?(?:and\\s+)?(?:now\\s+and\\s+)?(?:for\\s*)?ever(?:\\s+and\\s+ever)?',
      'now and forever',
      'Jesus Christ\\.?',
      '(?:Golemnities|Solemnities)[\\s\\w]*',
      'NoTE:[\\s\\S]*',
    ].join('|') +
  ')[\\s.,]*$',
  'i',
);

/* ------------------------------------------------------------------ passes */

function applyRules(text, rules) {
  let out = text;
  for (const [re, to] of rules) out = out.replace(re, to);
  return out;
}

/** Separate the curated glued pairs, matching the token exactly. */
function splitGluedPairs(text) {
  return text.replace(/\b[A-Za-z]+\b/g, (w) => GLUED_PAIRS[w] ?? w);
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
  let cut = -1;
  for (const m of body.matchAll(end)) {
    const stop = m.index + m[0].length;
    if (stop < MIN_BODY) continue;
    cut = stop;
    break;
  }

  // Where the doxology itself is mangled past recognition, the "Amen." the
  // extractor carried over still marks where the prayer stopped.
  if (cut < 0) {
    const amen = body.search(/\bAmen\.?/i);
    if (amen >= MIN_BODY) cut = amen + body.slice(amen).match(/\bAmen\.?/i)[0].length;
  }

  if (cut > 0 && cut <= body.length) {
    if (cut < body.length) tail = body.slice(cut).trim();
    body = body.slice(0, cut).trim();
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
  // Order matters: the whole-token ligature fixes need the original
  // characters, before the character pass rewrites them.
  const fix = (s) =>
    applyRules(
      splitGluedPairs(
        unglue(
          applyRules(applyRules(applyRules(s, AMBIGUOUS_TOKENS), LIGATURES), WORDS),
          note,
        ),
      ),
      AFTER_SPLIT,
    );

  // Flagged on the repaired text, not the original: the whole-token list above
  // resolves most of these, and reporting the ones it already fixed would send
  // someone to the book for nothing.
  for (const k of ['priestInvitation', 'priestConclusion']) {
    out[k] = fix(p[k]);
    if (AMBIGUOUS.test(out[k])) note('ambiguous ligature', `${k}: ${out[k].match(AMBIGUOUS)[0]}`);
  }
  out.intentions = p.intentions.map((t, i) => {
    const fixed = fix(t);
    if (AMBIGUOUS.test(fixed)) {
      note('ambiguous ligature', `intention ${i + 1}: ${fixed.match(AMBIGUOUS)[0]}`);
    }
    return fixed;
  });
  out.responseOptions = p.responseOptions.map(fix);

  // Conventions: the renderer supplies the rubric and the Amen.
  const { lead, body, tail } = splitConclusion(out.priestConclusion);
  const concl = body.replace(RUBRIC, ' ').replace(/\s+/g, ' ').trim();
  out.priestConclusion = stripTrailingAmen(concl).trim();

  out.intentions = out.intentions.map((t) =>
    t.replace(RUBRIC, ' ').replace(/\s+/g, ' ').replace(RUBRIC_REMNANT, '').trim(),
  );
  out.priestConclusion = out.priestConclusion.replace(RUBRIC_REMNANT, '').trim();

  // Done after the rubric is off the intentions, so that "unfinished" means
  // the sentence really is unfinished and not just missing its rubric.
  if (lead) reattachLead(out, lead, id, note);
  if (tail && !TAIL_DEBRIS.test(tail)) {
    // A tail long enough to hold a whole prayer is the facing page read twice;
    // the prayer it duplicates is stored under its own day already.
    const kind = /\d[.,]\s*That\b/.test(tail)
      ? 'bleed after conclusion holds part of another day - check it is stored there'
      : 'bleed after conclusion';
    note(kind, tail);
  }

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
    const glue = (v.match(/\b\w*[a-z][A-Z]\w*\b|\b[a-z]{15,}\b/g) ?? [])
      .filter((w) => !VOCAB.has(w.toLowerCase()));
    if (glue.length) note('possible glued words', `${k}: ${[...new Set(glue)].join(', ')}`);
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
  console.log(`\nintentions rejoined with their tail (${REJOINED.length}):`);
  for (const line of REJOINED) console.log(`  ${line}`);
}

if (write && !changed) {
  // Running again over a section already repaired would replace the worksheet
  // with a shorter one, and the column bleed it records is the office's only
  // copy of that text - it was taken out of the conclusion where it did not
  // belong. Refuse rather than quietly lose it. Repair from the .bak to
  // rebuild both together.
  console.log('\nalready repaired: nothing to write, worksheet left as it is.');
  console.log(`to redo it from scratch, restore ${path.basename(file)}.bak first.`);
} else if (write) {
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
