/**
 * USCCB provider - https://bible.usccb.org/bible/readings/MMDDYY.cfm
 *
 * This is the highest-fidelity source: it carries the psalm response, the Gospel
 * acclamation verse, and the lectionary's sense-line breaks, all of which our
 * missalette reproduces verbatim.
 *
 * USCCB protects this endpoint with a proof-of-work bot challenge ("Checking
 * connection", cookie X_Obolus_Proof). We do not attempt to solve it. When the
 * challenge appears we stop immediately, report it plainly, and let the caller
 * fall back to another provider or to a manual import.
 *
 * Two things keep a batch from walking into that challenge on every date:
 *
 *   - a cookie jar, so the short-lived grace cookie USCCB issues with a page it
 *     has served is returned on the next request rather than thrown away;
 *   - a cooldown, because a challenge is a state and asking again renews it.
 *
 * Both are ordinary polite-client behaviour. Neither computes the proof-of-work.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import axios from 'axios';
import config from '../../config.js';
import { toUsccbSlug } from '../../lib/dates.js';
import { RequestQueue, sleep } from '../../lib/httpQueue.js';
import {
  emptyReadings,
  makeAcclamation,
  makePsalm,
  makeReadingPart,
  normaliseText,
} from '../../lib/readingsShape.js';

const { usccb } = config;

export const queue = new RequestQueue({ minDelayMs: usccb.delayMs, name: 'usccb' });

export const id = 'usccb';
export const label = 'USCCB Daily Readings';

export function urlFor(iso) {
  return `${usccb.baseUrl}/${toUsccbSlug(iso)}.cfm`;
}

/** The interstitial USCCB serves to clients it wants to verify. */
export function isChallengePage(html) {
  return (
    typeof html === 'string' &&
    (html.includes('X_Obolus_Proof') ||
      /<title>\s*Checking connection\s*<\/title>/i.test(html))
  );
}

/* ------------------------------------------------------------------ *
 * Challenge cooldown
 *
 * The bot check is not a per-request verdict; it is a state USCCB puts our IP
 * into, and every request made while we are in it renews it. A batch walks 20-30
 * dates one after another, so before this existed the first challenge poisoned
 * the whole run: date 2 asked again, was challenged, renewed the block, and so
 * on to date 30. The office saw almost every day fall through to the fallback
 * feed, which publishes no psalm response and no Gospel acclamation - the "most
 * of them came out incomplete" the batch is being fixed for.
 *
 * So the first challenge opens the circuit. While it is open we do not touch
 * USCCB at all: cached pages still serve, and everything else fails fast to the
 * fallback. When the cooldown lapses the next date is allowed through as a
 * probe; if it succeeds the circuit closes and the rest of the batch is fetched
 * from USCCB again.
 * ------------------------------------------------------------------ */

let challengedUntil = 0;

/** Milliseconds left before USCCB may be asked again; 0 when it may be asked now. */
export function challengeCooldownMs(now = Date.now()) {
  return Math.max(0, challengedUntil - now);
}

export function openChallengeCooldown(now = Date.now()) {
  challengedUntil = now + usccb.challengeCooldownMs;
}

export function closeChallengeCooldown() {
  challengedUntil = 0;
}

function challengeError(iso, waitMs = 0) {
  const wait = Math.ceil(waitMs / 1000);
  const err = new Error(
    'USCCB is serving its bot-check page ("Checking connection") instead of the readings. ' +
      'LiturgyGen does not bypass that check. ' +
      (wait
        ? `Leaving USCCB alone for another ${wait}s so the block can lapse - this date is coming ` +
          'from the fallback feed. Re-run the batch afterwards and the gaps fill in.'
        : 'Wait for the block to lapse, run the batch from a network where the site loads ' +
          'normally, or import the readings manually.'),
  );
  err.status = 503;
  err.code = 'USCCB_CHALLENGE';
  err.date = iso;
  err.retryable = false;
  err.cooldownMs = waitMs;
  return err;
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

/**
 * Turn a `.content-body` node into lines, honouring <br> as a line break.
 *
 * The trailing `\s*` matters. Most USCCB pages are written "line<br>line", but
 * some - feast days, in practice - come back as "line<br>\nline". Both mean one
 * line break, so the newline the source already has must be swallowed with the
 * tag; left behind it became a second break, and the missalette printed a blank
 * line between every line of the reading. A real stanza break is a doubled
 * <br>, and still produces one blank line either way.
 */
function bodyLines($, node) {
  const html = $(node).html() || '';
  const withBreaks = html
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '\n');
  // Decode entities once, on text that already has its newlines.
  const text = cheerio.load(`<x>${withBreaks}</x>`)('x').text();
  return text.split('\n').map((line) => normaliseText(line));
}

/** Classify a USCCB block heading ("Reading 1", "Alleluia", "Gospel", ...). */
export function classifyHeading(heading) {
  const h = String(heading || '').toLowerCase();
  if (/responsorial|psalm/.test(h)) return 'psalm';
  if (/alleluia|acclamation|verse before the gospel|tract/.test(h)) return 'acclamation';
  if (/sequence/.test(h)) return 'sequence';
  if (/gospel/.test(h)) return 'gospel';
  if (/reading\s*(ii\b|2\b)|second reading/.test(h)) return 'reading2';
  if (/reading/.test(h)) return 'reading1';
  return null;
}

/**
 * When the lectionary offers a choice, USCCB gives each further option its own
 * block headed only "or" - it names no section of its own and belongs to
 * whichever block came before it. 8 September (the Nativity of the BVM) is the
 * usual example: First Reading "Micah 5:1-4a" then "or" "Romans 8:28-30", and a
 * long and short form of the Gospel the same way.
 */
export function isAlternativeHeading(heading) {
  return /^or[\s:]*$/i.test(String(heading || '').trim());
}

const REFRAIN_LINE = /^R\.?\s/i;
const REFRAIN_ONLY = /^R\.?\s*$/i;
/** The connector USCCB prints between a response and its alternative. */
const OR_LINE = /^or:?\s*$/i;

function stripRefrainMarker(line) {
  return line
    .replace(/^R\.?\s*/i, '')
    // USCCB prefixes the first refrain with the verse it is drawn from: "(6cd)".
    .replace(/^\(.*?\)\s*/, '')
    .trim();
}

/** Refrain + stanzas from "R. (6cd) refrain / verse / verse / R. refrain / ...". */
export function parsePsalmBody(lines, refrainFromMarkup) {
  let refrain = normaliseText(refrainFromMarkup) || null;
  let refrainAlt = null;
  const stanzas = [];
  let current = [];

  for (const line of lines) {
    if (!line) continue;
    // Many psalms offer a second response ("R. Blessed is he ... / or: / R.
    // Alleluia."). The "or:" is a connector, not a verse - left in place it used
    // to become a one-line stanza of its own between every real stanza.
    if (OR_LINE.test(line)) continue;
    if (REFRAIN_LINE.test(line) || REFRAIN_ONLY.test(line)) {
      const text = stripRefrainMarker(line);
      if (text) {
        if (!refrain) refrain = text;
        else if (!refrainAlt && text !== refrain) refrainAlt = text;
      }
      if (current.length) {
        stanzas.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) stanzas.push(current);

  return { refrain, refrainAlt, stanzas };
}

/** Refrain ("Alleluia, alleluia.") + the proper verse the commentator reads. */
export function parseAcclamationBody(lines, refrainFromMarkup) {
  let refrain = normaliseText(refrainFromMarkup) || null;
  const verse = [];

  for (const line of lines) {
    if (!line) continue;
    if (OR_LINE.test(line)) continue;
    if (REFRAIN_LINE.test(line) || REFRAIN_ONLY.test(line)) {
      const text = stripRefrainMarker(line);
      if (!refrain && text) refrain = text;
      continue;
    }
    verse.push(line);
  }

  return { refrain: refrain || 'Alleluia, alleluia.', verse };
}

/** Whether a parsed block carries text, rather than just a heading and citation. */
function hasContent(part) {
  if (!part) return false;
  if (Array.isArray(part.lines)) return part.lines.length > 0;
  if (Array.isArray(part.stanzas)) return part.stanzas.length > 0;
  if (Array.isArray(part.verse)) return part.verse.length > 0;
  return true;
}

export function parse(html, iso) {
  if (isChallengePage(html)) throw challengeError(iso);

  const $ = cheerio.load(html);
  const blocks = $('.wr-block.b-verse');

  if (!blocks.length) {
    const err = new Error(
      `The USCCB page for ${iso} contained no reading blocks. The page layout may have changed.`,
    );
    err.status = 502;
    err.code = 'USCCB_PARSE_FAILED';
    throw err;
  }

  const result = emptyReadings(iso, id, urlFor(iso));
  result.lectionary = normaliseText($('.b-lectionary .name').first().text()) || null;

  // The section an untitled "or" block belongs to: the last one we recognised,
  // whose heading it also borrows if it ends up being the option we use.
  let previousKind = null;
  const headings = new Map();

  blocks.each((_, element) => {
    const block = $(element);
    const blockHeading = normaliseText(block.find('.content-header .name').first().text());
    const alternative = isAlternativeHeading(blockHeading);
    // An "or" block carries no section name, so it inherits the one above it.
    const kind = alternative ? previousKind : classifyHeading(blockHeading);
    const heading = (alternative && headings.get(kind)) || blockHeading;
    const citation = normaliseText(block.find('.content-header .address a').first().text());
    const bodyNode = block.find('.content-body').first();
    const lines = bodyLines($, bodyNode);
    const strongText = normaliseText(bodyNode.find('strong').first().text());

    if (!kind) {
      if (heading) result.alternatives.push({ heading, citation, reason: 'unrecognised section' });
      return;
    }

    previousKind = kind;
    if (!alternative) headings.set(kind, blockHeading);

    let part;
    if (kind === 'psalm') {
      const { refrain, refrainAlt, stanzas } = parsePsalmBody(lines, strongText);
      part = makePsalm({ heading, citation, refrain, refrainAlt, stanzas });
    } else if (kind === 'acclamation') {
      const { refrain, verse } = parseAcclamationBody(lines, strongText);
      part = makeAcclamation({ heading, citation, refrain, verse });
    } else {
      part = makeReadingPart({ heading, citation, lines });
    }

    // The lectionary offers a choice here. The office always prints the first
    // option, so that is the one we keep and the rest are recorded for the
    // editor - unless the first came through with no text at all, in which case
    // an option that has some beats a section the missalette would print blank.
    if (result[kind] && (hasContent(result[kind]) || !hasContent(part))) {
      result.alternatives.push({
        heading,
        citation,
        kind,
        reason: 'optional reading - the first option is used',
      });
      return;
    }

    result[kind] = part;
  });

  if (!result.reading1 && !result.gospel) {
    const err = new Error(`No First Reading or Gospel found on the USCCB page for ${iso}.`);
    err.status = 502;
    err.code = 'USCCB_PARSE_FAILED';
    throw err;
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Cookies
 *
 * USCCB hands out a short-lived grace cookie (X_Obolus_Grace) with a page it
 * has decided to serve. Send it back and the next request is served too; drop
 * it and every request looks like a brand-new unverified visitor, which is what
 * the bot check is there to stop. We had no cookie jar at all, so a batch was
 * challenged from its second date onwards no matter how slowly it went - that
 * is why nearly every day came out of the fallback feed, without a psalm
 * response or a Gospel Acclamation.
 *
 * This is not a way around the check. The proof-of-work the challenge page asks
 * for is never computed; we only return a cookie the server itself gave us, as
 * any browser or HTTP client does.
 * ------------------------------------------------------------------ */

const cookies = new Map();

export function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

export function absorbCookies(response) {
  for (const raw of (response && response.headers && response.headers['set-cookie']) || []) {
    const [pair] = String(raw).split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

export function clearCookies() {
  cookies.clear();
}

/**
 * Headers consistent with the browser the User-Agent already claims to be.
 * Measured against the live site these make no difference to the bot check
 * either way - the cookie is what counts - but a client that says it is Chrome
 * should send what Chrome sends.
 */
function requestHeaders() {
  const headers = {
    'User-Agent': usccb.userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
  };
  if (cookies.size) headers.Cookie = cookieHeader();
  return headers;
}

/* The raw page is kept as well as the parsed result, so parser improvements can
 * be replayed over old dates without going back to USCCB. */
function rawCachePath(iso) {
  return path.join(usccb.cacheDir, `${toUsccbSlug(iso)}.html`);
}

function readRawCache(iso) {
  if (!usccb.cacheEnabled) return null;
  try {
    const html = fs.readFileSync(rawCachePath(iso), 'utf8');
    return isChallengePage(html) ? null : html;
  } catch {
    return null;
  }
}

function writeRawCache(iso, html) {
  if (!usccb.cacheEnabled) return;
  try {
    fs.mkdirSync(usccb.cacheDir, { recursive: true });
    fs.writeFileSync(rawCachePath(iso), html, 'utf8');
  } catch {
    /* the cache is an optimisation, never a requirement */
  }
}

export async function fetchHtml(iso, { force = false } = {}) {
  if (!force) {
    const cached = readRawCache(iso);
    if (cached) return cached;
  }

  // Circuit open: do not renew the block on this date's behalf. The caller falls
  // back, and the first date after the cooldown lapses probes USCCB again.
  const cooldown = challengeCooldownMs();
  if (cooldown > 0) throw challengeError(iso, cooldown);

  const url = urlFor(iso);
  let lastError = null;

  for (let attempt = 1; attempt <= usccb.maxRetries; attempt += 1) {
    const response = await queue.add(() =>
      axios.get(url, {
        timeout: usccb.timeoutMs,
        responseType: 'text',
        headers: requestHeaders(),
        validateStatus: () => true,
      }),
    ).catch((error) => ({ status: 0, data: '', transportError: error }));

    // Keep whatever USCCB set, including the grace cookie that authorises the
    // next date in the batch.
    absorbCookies(response);

    const { status, data } = response;

    if (status === 200 && !isChallengePage(data)) {
      // We are being served again, so a cooldown left over from an earlier date
      // has done its job. Let the rest of the batch through at full speed.
      closeChallengeCooldown();
      writeRawCache(iso, data);
      return data;
    }

    // A challenge is a deliberate "stop asking". Never retry into it, and hold
    // every other date off USCCB until the block has had time to lapse.
    if (status === 403 || isChallengePage(data)) {
      openChallengeCooldown();
      throw challengeError(iso, challengeCooldownMs());
    }

    if (status === 404) {
      const err = new Error(`USCCB has no readings page for ${iso} (HTTP 404).`);
      err.status = 404;
      err.code = 'USCCB_NOT_FOUND';
      err.retryable = false;
      throw err;
    }

    if (status === 429 || status === 503) {
      // We are going too fast. Slow the shared queue, then try again.
      const backoff = usccb.delayMs * 5 * attempt;
      queue.backOff(backoff);
      lastError = new Error(`USCCB rate-limited the request for ${iso} (HTTP ${status}).`);
      lastError.code = 'USCCB_RATE_LIMITED';
      if (attempt < usccb.maxRetries) {
        await sleep(backoff);
        continue;
      }
      break;
    }

    lastError =
      response.transportError ||
      new Error(`USCCB returned HTTP ${status} for ${iso}.`);
    if (attempt < usccb.maxRetries) {
      await sleep(usccb.delayMs * 2 * attempt);
    }
  }

  const err = new Error(
    `Could not fetch USCCB readings for ${iso}: ${lastError ? lastError.message : 'unknown error'}`,
  );
  err.status = 502;
  err.code = (lastError && lastError.code) || 'USCCB_UNAVAILABLE';
  throw err;
}

export async function fetchReadings(iso, options = {}) {
  return parse(await fetchHtml(iso, options), iso);
}

export default {
  id,
  label,
  urlFor,
  fetchReadings,
  fetchHtml,
  parse,
  isChallengePage,
  isAlternativeHeading,
  challengeCooldownMs,
  closeChallengeCooldown,
  clearCookies,
  queue,
};
