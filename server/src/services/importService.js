/**
 * Turning a parish's own prayer book into templates.
 *
 * An office arriving with no prayers in the library has two ways to fill it:
 * type each page into the Template Manager, which is hours of work, or hand
 * LiturgyGen the book. This is the second one. It takes a PDF or a photograph
 * of a page, gets the words out, and runs them through the parser the typing
 * screen already uses - so a scanned page and a typed one end up as the same
 * record by the same rules.
 *
 * THREE STAGES, DELIBERATELY SEPARATE
 * -----------------------------------
 *   1. extract   bytes  -> text, one string per page
 *   2. structure text   -> a draft template per page, with its warnings
 *   3. commit    drafts -> rows, but only the ones somebody approved
 *
 * Stage 3 is a second request on purpose. Optical character recognition gets
 * things wrong, and a prayer is read aloud at Mass: a silent import that writes
 * 180 pages straight into the library would be a liturgical correctness problem
 * wearing a convenience feature's clothes. So nothing here writes to the
 * database. `extract()` returns drafts, the office reads them, and the route
 * commits what they ticked.
 *
 * WHAT THE PARSER KNOWS, AND WHAT IT DOES NOT
 * -------------------------------------------
 * Stage 2 is `parseOrilloPage`, which knows ONE layout: a heading in capitals,
 * an invitation, the response in capitals, numbered intentions, a concluding
 * prayer. That is how the Orillo books are printed and it is a reasonable guess
 * at how most General Intercessions books are printed, because they are all
 * following the same rubric. It is still a guess. A book laid out differently
 * will parse badly rather than fail loudly, which is exactly why a human
 * approves every page before it is saved.
 *
 * The page's season, week and weekday are NOT guessed. The parser reads a title
 * off the page and nothing else, and a template with no season matches nothing
 * in the cascade - so the review step is where the office says which day each
 * page belongs to. Inferring that from a page number would be inventing
 * liturgical data, and the whole point of this application is not doing that.
 *
 * OCR IS AN OPTIONAL DEPENDENCY
 * -----------------------------
 * A PDF with a text layer - anything exported from a word processor, which is
 * most digital books - needs no OCR at all, and that path has no extra
 * dependency. Photographs and scanned PDFs do, and `tesseract.js` is loaded
 * only when one arrives. It is not in `package.json`: it pulls a WASM build and
 * a language model, which is a lot of install for an office that has a text
 * PDF, and the error below says exactly what to run if it is wanted.
 */

import { parseOrilloPage } from '../lib/orilloParser.js';

/** How many pages one upload may carry. A whole book is several uploads. */
export const MAX_PAGES = 120;

/* ------------------------------------------------------------------ *
 * Stage 1 - bytes to text
 * ------------------------------------------------------------------ */

/**
 * The text layer of a PDF, one string per page.
 *
 * Returns null for a PDF that has no text layer, which is what a scan is: the
 * pages are pictures and every one of them comes back empty. That is a
 * different problem from a broken file, so it gets a different answer and the
 * caller falls through to OCR.
 */
async function pdfTextLayer(bytes) {
  // The legacy build is the one that runs under Node without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // A prayer book is a document, not a web page: it has no business fetching
    // fonts or running anything.
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const pages = [];
  const count = Math.min(document.numPages, MAX_PAGES);
  for (let number = 1; number <= count; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    // `str` is the run of text; `hasEOL` is where the PDF itself broke the line,
    // and the parser works on lines, so that distinction has to survive.
    const text = content.items
      .map((item) => (item.hasEOL ? `${item.str}\n` : item.str))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    pages.push(text);
  }
  await document.destroy();

  const anyText = pages.some((text) => /[A-Za-z]{4}/.test(text));
  return anyText ? pages : null;
}

/**
 * Optical character recognition, for a photograph or a scan.
 *
 * Lazily imported, so an office with a text PDF never installs it. English
 * only: the books are printed in English, and offering a language picker for a
 * model nobody has downloaded would be a worse experience than this message.
 */
async function ocr(bytes) {
  let Tesseract;
  try {
    Tesseract = await import('tesseract.js');
  } catch {
    const error = new Error(
      'This looks like a scan or a photograph, which needs optical character recognition. ' +
        'Install it once with `npm install tesseract.js --workspace server` and try again, ' +
        'or export the book as a PDF with a text layer and upload that instead.',
    );
    error.status = 501;
    error.code = 'OCR_NOT_INSTALLED';
    throw error;
  }

  const { data } = await Tesseract.recognize(Buffer.from(bytes), 'eng');
  return [String(data.text || '').trim()];
}

/**
 * One uploaded file to text, one string per page.
 *
 * @param {Buffer} bytes
 * @param {string} contentType
 */
export async function extractText(bytes, contentType) {
  if (!bytes || !bytes.length) {
    throw Object.assign(new Error('The upload was empty.'), { status: 400 });
  }

  const type = String(contentType || '').toLowerCase();

  if (type.includes('pdf')) {
    const pages = await pdfTextLayer(bytes).catch((error) => {
      // A PDF that cannot be opened at all is the office's problem to see, not
      // something to silently retry as a picture.
      throw Object.assign(
        new Error(`That PDF could not be read: ${error.message}`),
        { status: 400 },
      );
    });
    if (pages) return { pages, how: 'pdf-text-layer' };
    // A scan wearing a PDF extension.
    const text = await ocr(bytes);
    return { pages: text, how: 'ocr' };
  }

  if (type.startsWith('image/')) {
    const pages = await ocr(bytes);
    return { pages, how: 'ocr' };
  }

  throw Object.assign(
    new Error('Upload a PDF, or a photograph of a page as a JPEG or PNG.'),
    { status: 415 },
  );
}

/* ------------------------------------------------------------------ *
 * Stage 2 - text to drafts
 * ------------------------------------------------------------------ */

/**
 * Where one page ends and the next begins, inside one long string.
 *
 * OCR of a multi-page scan comes back as a single block, and so does a PDF page
 * that holds several prayers. A new prayer always opens with a line in capitals
 * followed by an invitation, but the cheapest honest signal is the numbering
 * restarting at 1 after an intention above it - so that is what is used, and a
 * page that cannot be split stays whole and is reviewed whole.
 */
function splitPrayers(text) {
  const lines = String(text).split('\n');
  const starts = [];
  let seenIntention = false;

  lines.forEach((line, index) => {
    if (/^\s*1[.)]\s/.test(line) && seenIntention) {
      // Walk back to the heading or blank line above, so the invitation and the
      // response stay with the intentions they belong to.
      let start = index;
      while (start > 0 && lines[start - 1].trim()) start -= 1;
      starts.push(start);
      seenIntention = false;
      return;
    }
    if (/^\s*\d+[.)]\s/.test(line)) seenIntention = true;
  });

  if (!starts.length) return [text];

  const bounds = [0, ...starts, lines.length];
  const chunks = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const chunk = lines.slice(bounds[i], bounds[i + 1]).join('\n').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/**
 * Run the page through the typing screen's parser and report what came out.
 *
 * Never throws for a page it cannot read: a book is imported a hundred pages at
 * a time, and one unreadable page must not lose the ninety-nine around it. An
 * unparseable page comes back with `prayer: null` and its reason, and the review
 * screen shows it with its text so somebody can fix it by hand.
 */
function draftFrom(text, pageNumber) {
  try {
    const parsed = parseOrilloPage(text);
    const problems = [...parsed.warnings];

    // The cascade matches on season, week and weekday, and the parser reads
    // none of those off the page. Saying so here is what stops a page being
    // committed as a template that can never match a day.
    problems.push('Set which day or season this page belongs to before saving it.');

    return {
      page: pageNumber,
      text,
      prayer: {
        title: parsed.title || `Page ${pageNumber}`,
        priestInvitation: parsed.priestInvitation,
        responseOptions: parsed.responseOptions,
        intentions: parsed.intentions,
        priestConclusion: parsed.priestConclusion,
        // Filled in by whoever reviews it; see the note above.
        season: null,
        week: null,
        dayOfWeek: null,
        fixedDate: null,
        notes: `Imported from an uploaded prayer book, page ${pageNumber}.`,
      },
      problems,
    };
  } catch (error) {
    return { page: pageNumber, text, prayer: null, problems: [error.message] };
  }
}

/* ------------------------------------------------------------------ *
 * The whole of stages 1 and 2
 * ------------------------------------------------------------------ */

/**
 * @param {Buffer} bytes
 * @param {string} contentType
 * @returns {Promise<{how: string, drafts: Array}>}
 */
export async function extract(bytes, contentType) {
  const { pages, how } = await extractText(bytes, contentType);

  const drafts = [];
  for (const [index, pageText] of pages.entries()) {
    if (!pageText || !/[A-Za-z]{4}/.test(pageText)) continue;
    for (const chunk of splitPrayers(pageText)) {
      drafts.push(draftFrom(chunk, index + 1));
      if (drafts.length >= MAX_PAGES) break;
    }
    if (drafts.length >= MAX_PAGES) break;
  }

  if (!drafts.length) {
    throw Object.assign(
      new Error(
        'No prayers could be read out of that file. If it is a scan, it may be too faint; ' +
          'if it is a PDF of pictures, optical character recognition has to be installed.',
      ),
      { status: 422 },
    );
  }

  return { how, drafts };
}

export default { extract, extractText, MAX_PAGES };
