/**
 * docxService - renders a day's missalette page in the Campus Ministry Office
 * house format. The layout below is taken measurement-for-measurement from
 * "Needed info/Sample_readings.docx":
 *
 *   DECEMBER 04, 2024                                            (centred, bold)
 *   LITURGY OF THE WORD                                          (centred, bold)
 *   FIRST READING                                    Is 25:6-10a (right tab)
 *   A reading from the Book of the Prophet Isaiah                (bold)
 *   ...reading text, one lectionary sense-line per paragraph...
 *   The Word of the Lord.                                        (bold italic)
 *   All: Thanks be to God.                                       (italic)
 *
 *   RESPONSORIAL PSALM                        Ps 23:1-3a, 3b-4, 5, 6
 *   R. I SHALL LIVE IN THE HOUSE OF THE LORD...   (first refrain in caps, bold)
 *   ...verses, with the refrain repeated between stanzas...
 *
 *   R. Alleluia, alleluia.
 *   Commentator : Behold, the Lord comes to save his people;
 *   R. Alleluia, alleluia.
 *
 *   FIRST WEEK OF ADVENT - WEDNESDAY                             (centred, bold)
 *   Priest: <invitation>
 *   LORD, HEAR OUR PRAYER.  /  OR  /  GOD, OUR PROVIDER, BLESS US.
 *   1. <intention> Let us pray to the Lord.
 *   Priest: <conclusion> Amen.
 */

import {
  AlignmentType,
  Document,
  LineRuleType,
  PageBreak,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import { formatHeaderDate, readingsFileName } from '../lib/dates.js';

/* ------------------------------------------------------------------ *
 * House style
 * ------------------------------------------------------------------ */

const TWIPS_PER_INCH = 1440;

export const DEFAULT_STYLE = {
  font: 'Book Antiqua',
  page: {
    // US Letter, with the exact margins of the sample document.
    width: 12240,
    height: 15840,
    margins: { top: 1530, right: 1170, bottom: 810, left: 1440 },
  },
  // Half-points, as Word stores them: 28 = 14pt.
  size: {
    dateHeader: 31,
    liturgyHeader: 31,
    sectionLabel: 32,
    readingIntro: 32,
    readingBody: 28,
    responseCue: 28,
    psalm: 30,
    acclamation: 32,
    potfTitle: 28,
    potfBody: 28,
  },
  /**
   * Hex, as Word stores it. Taken from "Needed info/Sample_readings2.docx":
   * the office prints headings in a dark maroon and the repeated psalm
   * responses in a brighter red.
   */
  color: {
    heading: 'C00000',
    /** The psalm's opening response - maroon, and highlighted. */
    refrainFirst: 'C00000',
    /** The same response repeated between stanzas. */
    refrainRepeat: 'FF0000',
    commentator: 'FF0000',
  },
  text: {
    liturgyHeader: 'LITURGY OF THE WORD',
    firstReadingLabel: 'FIRST READING',
    secondReadingLabel: 'SECOND READING',
    psalmLabel: 'RESPONSORIAL PSALM',
    gospelLabel: 'GOSPEL',
    sequenceLabel: 'SEQUENCE',
    wordOfTheLord: 'The Word of the Lord.',
    thanksBeToGod: 'All: Thanks be to God.',
    gospelOfTheLord: 'The Gospel of the Lord.',
    praiseToYou: 'All: Praise to you, Lord Jesus Christ.',
    commentator: 'Commentator',
    priest: 'Priest:',
    intentionSuffix: 'Let us pray to the Lord.',
    responseSeparator: 'OR',
    amen: 'Amen.',
  },
  options: {
    /** The Gospel is proclaimed from the lectionary, so the office decides per
     *  batch whether to print it for the assembly. */
    includeGospel: false,
    /**
     * Each reading and the prayers start on a fresh page, so a reader is never
     * turning a page mid-reading. The psalm and the acclamation are deliberately
     * left to flow together - on a weekday they share one page.
     */
    separatePages: true,
    /** Word highlight name, or null for none. */
    highlightFirstRefrain: 'yellow',
    includeSequence: true,
    /** Repeat the psalm response between stanzas, as the lectionary does. */
    repeatPsalmRefrain: true,
    /** The first response is printed in capitals, the repeats in sentence case. */
    firstRefrainUppercase: true,
    /** Append "Let us pray to the Lord." to each intention. */
    appendIntentionSuffix: true,
    /** Blank line between numbered intentions, as in the sample. */
    spaceBetweenIntentions: true,
  },
};

/** Deep-ish merge so callers can override just one nested key. */
export function resolveStyle(overrides = {}) {
  return {
    ...DEFAULT_STYLE,
    ...overrides,
    page: { ...DEFAULT_STYLE.page, ...(overrides.page || {}) },
    size: { ...DEFAULT_STYLE.size, ...(overrides.size || {}) },
    color: { ...DEFAULT_STYLE.color, ...(overrides.color || {}) },
    text: { ...DEFAULT_STYLE.text, ...(overrides.text || {}) },
    options: { ...DEFAULT_STYLE.options, ...(overrides.options || {}) },
  };
}

/* ------------------------------------------------------------------ *
 * Paragraph builders
 * ------------------------------------------------------------------ */

const SINGLE_LINE = { line: 240, lineRule: LineRuleType.AUTO };

function run(style, text, extra = {}) {
  return new TextRun({ text, font: style.font, ...extra });
}

function centred(style, text, { size, bold = true, spacing, color, pageBreakBefore } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    pageBreakBefore,
    spacing: { ...SINGLE_LINE, ...(spacing || {}) },
    children: [run(style, text, { bold, size, color })],
  });
}

function plain(style, children, { alignment, spacing } = {}) {
  return new Paragraph({
    alignment,
    spacing: { after: 0, ...SINGLE_LINE, ...(spacing || {}) },
    children,
  });
}

/** "FIRST READING <tab to right margin> Is 25:6-10a" */
function sectionHeading(style, label, citation, { pageBreakBefore } = {}) {
  const rightMargin =
    style.page.width - style.page.margins.left - style.page.margins.right;
  const color = style.color.heading;

  const children = [run(style, label, { bold: true, size: style.size.sectionLabel, color })];
  if (citation) {
    children.push(
      new TextRun({
        font: style.font,
        bold: true,
        color,
        size: style.size.sectionLabel,
        children: [new Tab(), citation],
      }),
    );
  }

  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: rightMargin }],
    pageBreakBefore,
    spacing: { before: 240, after: 0, ...SINGLE_LINE },
    children,
  });
}

/** Reading text: one paragraph per lectionary line, blanks become empty lines. */
function readingBody(style, lines) {
  return lines.map((line) =>
    plain(style, line ? [run(style, line, { size: style.size.readingBody })] : []),
  );
}

function readingSection(style, part, { label, closing, response, pageBreakBefore }) {
  if (!part) return [];
  const out = [sectionHeading(style, label, part.citation, { pageBreakBefore })];

  if (part.intro) {
    out.push(plain(style, [run(style, part.intro, { bold: true, size: style.size.readingIntro })]));
  }

  out.push(...readingBody(style, part.lines));
  out.push(plain(style, []));

  if (closing) {
    out.push(
      plain(style, [run(style, closing, { bold: true, italics: true, size: style.size.responseCue })]),
    );
  }
  if (response) {
    out.push(
      new Paragraph({
        spacing: { line: 360, lineRule: LineRuleType.AUTO },
        children: [run(style, response, { italics: true, size: style.size.responseCue })],
      }),
    );
  }
  return out;
}

/**
 * The psalm is one paragraph held together by line breaks - that is how the
 * sample is built, and it keeps a stanza from splitting across a page.
 */
function psalmSection(style, psalm, { pageBreakBefore } = {}) {
  if (!psalm) return [];
  const out = [
    sectionHeading(style, style.text.psalmLabel, psalm.citation, { pageBreakBefore }),
  ];

  const size = style.size.psalm;
  const children = [];
  let firstLine = true;

  /**
   * The opening response is set apart - maroon and highlighted - because it is
   * the one the assembly has to find and learn. The repeats between stanzas are
   * only a reminder, so they take the lighter red.
   */
  const pushRefrain = (uppercase) => {
    if (!psalm.refrain) return;
    const first = firstLine;
    const color = first ? style.color.refrainFirst : style.color.refrainRepeat;
    const highlight = first ? style.options.highlightFirstRefrain || undefined : undefined;
    children.push(run(style, 'R. ', { size, color, highlight, break: first ? 0 : 1 }));
    children.push(
      run(style, uppercase ? psalm.refrain.toUpperCase() : psalm.refrain, {
        bold: true,
        size,
        color,
        highlight,
      }),
    );
    firstLine = false;
  };

  pushRefrain(style.options.firstRefrainUppercase);

  psalm.stanzas.forEach((stanza, index) => {
    stanza.forEach((line) => {
      children.push(run(style, line, { size, break: firstLine ? 0 : 1 }));
      firstLine = false;
    });
    const isLast = index === psalm.stanzas.length - 1;
    if (style.options.repeatPsalmRefrain || isLast) pushRefrain(false);
  });

  out.push(new Paragraph({ spacing: SINGLE_LINE, children }));
  out.push(plain(style, []));
  return out;
}

function acclamationSection(style, acclamation) {
  if (!acclamation) return [];
  const size = style.size.acclamation;
  const refrain = acclamation.refrain || 'Alleluia, alleluia.';
  const out = [];

  out.push(plain(style, [run(style, `R. ${refrain}`, { bold: true, size })]));

  acclamation.verse.forEach((line, index) => {
    if (index === 0) {
      out.push(
        plain(style, [
          run(style, style.text.commentator, {
            bold: true,
            italics: true,
            size,
            color: style.color.commentator,
          }),
          run(style, ' : ', { size: style.size.psalm, color: style.color.commentator }),
          run(style, line, { size }),
        ]),
      );
    } else {
      out.push(plain(style, [run(style, line, { size })]));
    }
  });

  out.push(
    plain(style, [
      run(style, 'R. ', { bold: true, size }),
      run(style, refrain, { size }),
    ]),
  );
  out.push(plain(style, []));
  return out;
}

/* ------------------------------------------------------------------ *
 * Prayers of the Faithful
 * ------------------------------------------------------------------ */

function potfSection(style, potf, occasionTitle, { pageBreakBefore } = {}) {
  if (!potf) return [];
  const size = style.size.potfBody;
  const out = [];

  if (occasionTitle) {
    out.push(
      centred(style, occasionTitle, {
        size: style.size.potfTitle,
        color: style.color.heading,
        pageBreakBefore,
      }),
    );
  }

  if (potf.priestInvitation) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        // Carries the break itself when there is no occasion title above it.
        pageBreakBefore: occasionTitle ? undefined : pageBreakBefore,
        children: [
          run(style, style.text.priest, { bold: true, size, color: style.color.heading }),
          run(style, ` ${potf.priestInvitation}`, { bold: true, size }),
        ],
      }),
    );
  }

  const responses = (potf.responseOptions || []).filter(Boolean);
  responses.forEach((response, index) => {
    if (index > 0) {
      out.push(
        centred(style, style.text.responseSeparator, {
          size,
          spacing: { before: 480, after: 360 },
        }),
      );
    }
    out.push(
      centred(style, response.toUpperCase(), {
        size,
        spacing: index > 0 ? { before: 240 } : undefined,
      }),
    );
  });

  (potf.intentions || []).filter(Boolean).forEach((intention, index) => {
    const body = intention.trim();
    const needsPeriod = style.options.appendIntentionSuffix && !/[.?!]$/.test(body);
    const children = [
      run(style, `${index + 1}. `, { size }),
      run(style, needsPeriod ? `${body}.` : body, { size }),
    ];
    if (style.options.appendIntentionSuffix) {
      children.push(run(style, ' ', { size }));
      children.push(
        run(style, style.text.intentionSuffix, { bold: true, italics: true, size }),
      );
    }
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 0, ...SINGLE_LINE },
        children,
      }),
    );
    if (style.options.spaceBetweenIntentions) {
      out.push(
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 0, ...SINGLE_LINE } }),
      );
    }
  });

  if (potf.priestConclusion) {
    const conclusion = potf.priestConclusion.trim();
    const withAmen = /amen\.?$/i.test(conclusion)
      ? conclusion
      : `${conclusion}${/[.?!]$/.test(conclusion) ? '' : '.'} ${style.text.amen}`;
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 0, ...SINGLE_LINE },
        children: [
          run(style, style.text.priest, {
            bold: true,
            italics: true,
            size,
            color: style.color.heading,
          }),
          run(style, ` ${withAmen}`, { bold: true, size }),
        ],
      }),
    );
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Page assembly
 * ------------------------------------------------------------------ */

/**
 * All paragraphs for one date. `day` is:
 *   { date, occasionTitle, readings, potf }
 */
export function buildDayParagraphs(day, styleOverrides = {}) {
  const style = resolveStyle(styleOverrides);
  const readings = day.readings || {};
  const paragraphs = [];

  paragraphs.push(centred(style, formatHeaderDate(day.date), { size: style.size.dateHeader }));
  paragraphs.push(centred(style, style.text.liturgyHeader, { size: style.size.liturgyHeader }));

  /**
   * Each reading and the prayers open a fresh page; the psalm and the
   * acclamation are left to flow. On a weekday - the office's daily case -
   * that puts the first reading on its own page, the psalm and the Alleluia
   * together on the next, then the Gospel if it is printed, then the prayers.
   * On a Sunday the second reading takes the page after the psalm, and the
   * acclamation follows it down onto the Gospel's page.
   */
  const breaks = style.options.separatePages;
  // Nothing has been printed after the header yet, so the first section that
  // asks for a break would otherwise open on a blank page.
  let anySectionPrinted = false;
  const breakBefore = () => {
    const wanted = breaks && anySectionPrinted;
    anySectionPrinted = true;
    return wanted || undefined;
  };

  paragraphs.push(
    ...readingSection(style, readings.reading1, {
      label: style.text.firstReadingLabel,
      closing: style.text.wordOfTheLord,
      response: style.text.thanksBeToGod,
      pageBreakBefore: readings.reading1 ? breakBefore() : undefined,
    }),
  );

  paragraphs.push(
    ...psalmSection(style, readings.psalm, {
      pageBreakBefore: readings.psalm ? breakBefore() : undefined,
    }),
  );

  paragraphs.push(
    ...readingSection(style, readings.reading2, {
      label: style.text.secondReadingLabel,
      closing: style.text.wordOfTheLord,
      response: style.text.thanksBeToGod,
      pageBreakBefore: readings.reading2 ? breakBefore() : undefined,
    }),
  );

  if (style.options.includeSequence && readings.sequence) {
    paragraphs.push(
      ...readingSection(style, readings.sequence, {
        label: style.text.sequenceLabel,
        pageBreakBefore: breakBefore(),
      }),
    );
  }

  // Deliberately no break: the acclamation rides with whatever precedes it.
  paragraphs.push(...acclamationSection(style, readings.acclamation));

  if (style.options.includeGospel && readings.gospel) {
    paragraphs.push(
      ...readingSection(style, readings.gospel, {
        label: style.text.gospelLabel,
        closing: style.text.gospelOfTheLord,
        response: style.text.praiseToYou,
        pageBreakBefore: breakBefore(),
      }),
    );
  }

  paragraphs.push(
    ...potfSection(style, day.potf, day.occasionTitle, {
      pageBreakBefore: day.potf ? breakBefore() : undefined,
    }),
  );

  return paragraphs;
}

function documentFor(paragraphs, style, title) {
  return new Document({
    creator: 'LiturgyGen',
    title,
    description: 'Mass readings and Prayers of the Faithful',
    styles: {
      default: {
        document: {
          run: { font: style.font, size: style.size.readingBody },
          paragraph: { spacing: { after: 0, ...SINGLE_LINE } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: style.page.width, height: style.page.height },
            margin: style.page.margins,
          },
        },
        children: paragraphs,
      },
    ],
  });
}

/** A single-date .docx buffer. */
export async function buildDayDocx(day, styleOverrides = {}) {
  const style = resolveStyle(styleOverrides);
  const doc = documentFor(buildDayParagraphs(day, styleOverrides), style, day.occasionTitle || day.date);
  return Packer.toBuffer(doc);
}

/**
 * One master .docx with every date in order, separated by page breaks.
 * Batch "Option B".
 */
export async function buildCombinedDocx(days, styleOverrides = {}) {
  const style = resolveStyle(styleOverrides);
  const paragraphs = [];

  days.forEach((day, index) => {
    if (index > 0) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }
    paragraphs.push(...buildDayParagraphs(day, styleOverrides));
  });

  const title = days.length
    ? `Mass Readings ${formatHeaderDate(days[0].date)} - ${formatHeaderDate(days[days.length - 1].date)}`
    : 'Mass Readings';

  return Packer.toBuffer(documentFor(paragraphs, style, title));
}

export function fileNameFor(iso) {
  return readingsFileName(iso);
}

export const INCHES = TWIPS_PER_INCH;

export default {
  buildDayDocx,
  buildCombinedDocx,
  buildDayParagraphs,
  fileNameFor,
  DEFAULT_STYLE,
  resolveStyle,
};
