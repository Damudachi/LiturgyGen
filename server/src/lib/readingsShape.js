/**
 * The single reading shape every provider must produce, plus helpers to build
 * and validate it. Keeping this in one place means docxService never has to care
 * which source a day's readings came from.
 *
 *   {
 *     date, source, sourceUrl, warnings: [],
 *     reading1 | reading2 | sequence | gospel: { heading, citation, intro, lines: [] },
 *     psalm:        { heading, citation, refrain, stanzas: [[line, ...], ...] },
 *     acclamation:  { heading, citation, refrain, verse: [line, ...] },
 *   }
 *
 * A blank string inside `lines` is a stanza break and is rendered as an empty
 * paragraph, matching how the lectionary lays out poetry.
 */

import { readingIntroLine } from './bibleBooks.js';

export const READING_PARTS = ['reading1', 'reading2', 'sequence', 'gospel'];

export function emptyReadings(date, source, sourceUrl = null) {
  return {
    date,
    source,
    sourceUrl,
    lectionary: null,
    reading1: null,
    reading2: null,
    psalm: null,
    acclamation: null,
    sequence: null,
    gospel: null,
    warnings: [],
    alternatives: [],
  };
}

export function makeReadingPart({ heading, citation, lines, intro }) {
  const cleanCitation = normaliseText(citation);
  return {
    heading: heading || null,
    citation: cleanCitation || null,
    intro: intro !== undefined ? intro : readingIntroLine(cleanCitation),
    lines: normaliseLines(lines),
  };
}

export function makePsalm({ heading, citation, refrain, refrainAlt, stanzas }) {
  return {
    heading: heading || 'Responsorial Psalm',
    citation: normaliseText(citation) || null,
    refrain: normaliseText(refrain) || null,
    /** The "or:" response some psalms offer, kept so the office can choose. */
    refrainAlt: normaliseText(refrainAlt) || null,
    stanzas: (stanzas || []).map(normaliseLines).filter((stanza) => stanza.length > 0),
  };
}

export function makeAcclamation({ heading, citation, refrain, verse }) {
  return {
    heading: heading || 'Gospel Acclamation',
    citation: normaliseText(citation) || null,
    refrain: normaliseText(refrain) || 'Alleluia, alleluia.',
    verse: normaliseLines(verse),
  };
}

export function normaliseText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trim each line, collapse repeated blank lines, drop leading/trailing blanks. */
export function normaliseLines(lines) {
  const cleaned = (lines || []).map(normaliseText);
  const collapsed = [];
  for (const line of cleaned) {
    if (line === '' && (collapsed.length === 0 || collapsed[collapsed.length - 1] === '')) continue;
    collapsed.push(line);
  }
  while (collapsed.length && collapsed[collapsed.length - 1] === '') collapsed.pop();
  return collapsed;
}

/**
 * Report what a day is missing so the UI can flag it before anyone prints 30
 * copies. Returns human-readable strings, not codes - they go straight on screen.
 */
export function auditReadings(readings) {
  const gaps = [];
  if (!readings.reading1) gaps.push('First Reading is missing.');
  else if (!readings.reading1.lines.length) gaps.push('First Reading has no text.');

  if (!readings.psalm) gaps.push('Responsorial Psalm is missing.');
  else {
    if (!readings.psalm.refrain) gaps.push('Responsorial Psalm has no response (R.) - add it manually.');
    if (!readings.psalm.stanzas.length) gaps.push('Responsorial Psalm has no verses.');
  }

  if (!readings.acclamation) gaps.push('Gospel Acclamation is missing.');
  else if (!readings.acclamation.verse.length) {
    gaps.push('Gospel Acclamation has no verse - add it manually.');
  }

  if (!readings.gospel) gaps.push('Gospel is missing.');
  return gaps;
}

export function isComplete(readings) {
  return auditReadings(readings).length === 0;
}
