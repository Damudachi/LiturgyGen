/**
 * Evangelizo provider - https://feed.evangelizo.org/v2/reader.php
 *
 * A public feed the Evangelizo Association publishes for exactly this purpose
 * ("will help you to display daily reading in your website"). We use it as a
 * fallback when USCCB is unavailable.
 *
 * Two limits the office must know about, both surfaced as warnings on every day
 * this provider fills:
 *   - the feed only answers for dates within ~30 days of today;
 *   - it carries no responsorial psalm RESPONSE and no Gospel acclamation verse,
 *     so those two lines still have to be typed in before printing.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { RequestQueue } from '../../lib/httpQueue.js';
import { bookKeyFromName, citationAbbrev, readingIntroLine } from '../../lib/bibleBooks.js';
import {
  emptyReadings,
  makePsalm,
  makeReadingPart,
  normaliseText,
} from '../../lib/readingsShape.js';

export const id = 'evangelizo';
export const label = 'Evangelizo daily readings feed';

const BASE_URL = 'https://feed.evangelizo.org/v2/reader.php';
const LANG = 'AM'; // American English, which follows the NAB like USCCB does.
const WINDOW_DAYS = 30;

export const queue = new RequestQueue({ minDelayMs: 700, name: 'evangelizo' });

export function urlFor(iso) {
  return `${BASE_URL}?date=${iso.replace(/-/g, '')}&type=all&lang=${LANG}`;
}

/** The feed refuses dates further than ~30 days out; fail fast rather than fetch. */
export function supportsDate(iso, today = new Date()) {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.abs(target - now) <= WINDOW_DAYS * 86400000;
}

/**
 * "9,1-12.14-16." -> "9:1-12, 14-16"
 * "139(138),1-3.13-14ab." -> "139:1-3, 13-14ab"
 * Evangelizo writes references in the continental style; our missalette uses the
 * Anglophone lectionary style.
 */
export function normaliseReference(reference) {
  let ref = normaliseText(reference).replace(/\.\s*$/, '');
  if (!ref) return '';
  // Drop the Greek/Septuagint psalm number in parentheses.
  ref = ref.replace(/\((\d+)\)/g, '');
  const [chapter, ...rest] = ref.split(',');
  if (!rest.length) return chapter.trim();
  const verses = rest.join(',').split('.').map((part) => part.trim()).filter(Boolean);
  return `${chapter.trim()}:${verses.join(', ')}`;
}

const BR = /\s*<br\s*\/?>\s*/gi;

/**
 * The feed is one blob of <br>-separated text. Three or more breaks separate
 * readings, two separate stanzas within a reading, and one separates lines.
 * The liturgical title at the top is joined to the first reading by only two
 * breaks, so it is peeled off the first chunk rather than split out.
 */
function splitSections(html) {
  const sections = html
    .split(/(?:\s*<br\s*\/?>\s*){3,}/i)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!sections.length) return { title: '', sections: [] };

  const [head, ...rest] = sections;
  const headParts = head.split(/(?:\s*<br\s*\/?>\s*){2,}/i);
  const title = headParts.shift().trim();
  // Rejoin the remainder with a stanza break so poetry keeps its shape.
  const firstReading = headParts.join('<br /><br />').trim();

  return { title, sections: [firstReading, ...rest].filter(Boolean) };
}

function parseSection(section) {
  const $ = cheerio.load(`<div>${section}</div>`);
  const reference = normaliseReference($('font').first().text());
  $('font').remove();

  // Collapse the whitespace the feed puts around each <br> so a stanza break
  // stays exactly one blank line.
  const withBreaks = $('div')
    .html()
    .replace(BR, '\n')
    .replace(/<[^>]+>/g, '');
  const text = cheerio.load(`<x>${withBreaks}</x>`)('x').text();

  const allLines = text.split('\n').map(normaliseText);
  // The first non-empty line is the book name; the rest is the reading.
  const firstIndex = allLines.findIndex((line) => line !== '');
  if (firstIndex === -1) return null;

  const bookLine = allLines[firstIndex];
  const lines = allLines.slice(firstIndex + 1);
  const key = bookKeyFromName(bookLine);
  const abbrev = citationAbbrev(key);

  return {
    bookLine,
    key,
    citation: abbrev && reference ? `${abbrev} ${reference}` : reference || bookLine,
    lines,
  };
}

export function parse(body, iso) {
  const { title, sections } = splitSections(body);
  if (sections.length < 2) {
    const err = new Error(`Evangelizo returned no usable readings for ${iso}.`);
    err.status = 502;
    err.code = 'EVANGELIZO_PARSE_FAILED';
    throw err;
  }

  const result = emptyReadings(iso, id, urlFor(iso));
  result.lectionary = null;
  result.liturgicalTitle = normaliseText(cheerio.load(`<x>${title}</x>`)('x').text());

  // Readings come in lectionary order: first reading, psalm, [second], Gospel.
  const parsed = sections.map(parseSection).filter(Boolean);
  if (parsed.length < 2) {
    const err = new Error(`Evangelizo returned only ${parsed.length} reading(s) for ${iso}.`);
    err.status = 502;
    err.code = 'EVANGELIZO_PARSE_FAILED';
    throw err;
  }

  const gospel = parsed[parsed.length - 1];
  const middle = parsed.slice(0, -1);
  const psalmIndex = middle.findIndex((section) => section.key === 'ps');

  const first = middle[0] && middle[0].key !== 'ps' ? middle[0] : null;
  const psalm = psalmIndex >= 0 ? middle[psalmIndex] : null;
  const second = psalmIndex >= 0 ? middle[psalmIndex + 1] : null;

  if (first) {
    result.reading1 = makeReadingPart({
      heading: 'Reading 1',
      citation: first.citation,
      intro: readingIntroLine(first.citation) || `A reading from the ${first.bookLine}`,
      lines: first.lines,
    });
  }

  if (psalm) {
    result.psalm = makePsalm({
      heading: 'Responsorial Psalm',
      citation: psalm.citation,
      refrain: null,
      // The feed separates stanzas with a blank line.
      stanzas: psalm.lines
        .join('\n')
        .split(/\n\s*\n/)
        .map((stanza) => stanza.split('\n')),
    });
  }

  if (second) {
    result.reading2 = makeReadingPart({
      heading: 'Reading 2',
      citation: second.citation,
      intro: readingIntroLine(second.citation) || `A reading from the ${second.bookLine}`,
      lines: second.lines,
    });
  }

  if (gospel) {
    result.gospel = makeReadingPart({
      heading: 'Gospel',
      citation: gospel.citation,
      intro: readingIntroLine(gospel.citation) || `A reading from the ${gospel.bookLine}`,
      lines: gospel.lines,
    });
  }

  result.warnings.push(
    'Filled from the Evangelizo feed: the psalm response (R.) and the Gospel acclamation verse are not published there and must be added by hand.',
  );

  return result;
}

export async function fetchReadings(iso) {
  if (!supportsDate(iso)) {
    const err = new Error(
      `Evangelizo only serves dates within ${WINDOW_DAYS} days of today, so it cannot supply ${iso}.`,
    );
    err.status = 400;
    err.code = 'EVANGELIZO_OUT_OF_RANGE';
    err.retryable = false;
    throw err;
  }

  const response = await queue.add(() =>
    axios.get(urlFor(iso), {
      timeout: 20000,
      responseType: 'text',
      headers: { 'User-Agent': 'LiturgyGen/1.0 (parish missalette generator)' },
      validateStatus: () => true,
    }),
  );

  if (response.status !== 200) {
    const err = new Error(`Evangelizo returned HTTP ${response.status} for ${iso}.`);
    err.status = 502;
    err.code = 'EVANGELIZO_UNAVAILABLE';
    throw err;
  }

  if (/Error\s*:/i.test(response.data.slice(0, 400))) {
    const err = new Error(`Evangelizo rejected the request for ${iso}.`);
    err.status = 502;
    err.code = 'EVANGELIZO_REJECTED';
    throw err;
  }

  return parse(response.data, iso);
}

export default { id, label, urlFor, fetchReadings, parse, supportsDate, normaliseReference, queue };
