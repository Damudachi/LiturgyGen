/**
 * orilloParser - turns a page of a General Intercessions book, typed or pasted
 * exactly as it is printed, into the shape potfService.createTemplate expects.
 *
 * The office types what they see. The printed page always runs in this order:
 *
 *   SECOND OF JANUARY                  <- optional heading
 *
 *   <invitation, one paragraph>
 *
 *   LORD, HEAR OUR PRAYER.             <- the response, in capitals
 *   Or                                 <- optional
 *   DIVINE MASTER, LET YOUR SPIRIT BE UPON US.
 *
 *   1. That ... Let us pray to the Lord.
 *   ...
 *   5. That ... Let us pray to the Lord.
 *
 *   <concluding prayer ... Amen.>
 *
 * We strip the two phrases the renderer adds back itself - the trailing
 * "Let us pray to the Lord." on every intention and the "Amen." closing the
 * conclusion - so a template never carries them twice.
 */

/** A line printed in capitals, i.e. a heading or a response. */
function isCapitalised(line) {
  if (!/[A-Za-z]/.test(line)) return false;
  if (/^\d/.test(line)) return false;
  return line === line.toUpperCase();
}

/** The connector the book prints between a response and its alternative. */
function isOrConnector(line) {
  return /^or:?$/i.test(line.trim());
}

/** Page numbers and running heads sit alone on a line and carry no letters. */
function isPageFurniture(line) {
  return /^[\d\s.\-—]+$/.test(line);
}

function squash(lines) {
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

const TRAILING_RESPONSE = /[\s.,]*let us pray to the lord[.!]?$/i;
const TRAILING_AMEN = /[\s.,]*amen[.!]?$/i;

export function stripTrailingResponse(text) {
  return text.replace(TRAILING_RESPONSE, '').replace(/[\s,]+$/, '');
}

export function stripTrailingAmen(text) {
  return text.replace(TRAILING_AMEN, '').replace(/[\s,]+$/, '');
}

/**
 * @param {string} raw  the page as typed
 * @returns {{title: string|null, priestInvitation: string, responseOptions: string[],
 *            intentions: string[], priestConclusion: string, warnings: string[]}}
 */
export function parseOrilloPage(raw) {
  const warnings = [];
  const lines = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !isPageFurniture(line));

  if (!lines.some((line) => line.length)) {
    const error = new Error('Nothing to import - paste the prayer first.');
    error.status = 400;
    throw error;
  }

  let index = 0;
  const skipBlanks = () => { while (index < lines.length && !lines[index]) index += 1; };

  // A heading is printed in capitals but, unlike a response, is not a sentence.
  skipBlanks();
  let title = null;
  if (index < lines.length && isCapitalised(lines[index]) && !lines[index].endsWith('.')) {
    title = lines[index];
    index += 1;
  }

  // Everything up to the first capitalised line is the priest's invitation.
  const invitationLines = [];
  skipBlanks();
  while (index < lines.length && !isCapitalised(lines[index])) {
    if (lines[index]) invitationLines.push(lines[index]);
    index += 1;
  }
  const priestInvitation = squash(invitationLines);
  if (!priestInvitation) warnings.push('No invitation found before the response.');

  // The response, plus any alternative printed under an "Or".
  const responseOptions = [];
  while (index < lines.length) {
    if (!lines[index] || isOrConnector(lines[index])) { index += 1; continue; }
    if (!isCapitalised(lines[index])) break;
    const response = lines[index].replace(/\s+/g, ' ').trim();
    if (!responseOptions.includes(response)) responseOptions.push(response);
    index += 1;
  }
  if (!responseOptions.length) warnings.push('No response in capitals was found.');

  // Numbered intentions, each possibly wrapped over several printed lines.
  const intentions = [];
  let current = null;
  const flush = () => {
    if (current === null) return;
    const text = stripTrailingResponse(squash(current));
    if (text) intentions.push(text);
    current = null;
  };

  const conclusionLines = [];
  let inConclusion = false;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const numbered = line.match(/^(\d+)[.)]\s*(.*)$/);
    if (numbered) {
      flush();
      inConclusion = false;
      current = [numbered[2]];
      continue;
    }
    if (current !== null && !inConclusion) {
      // The concluding prayer is the first unnumbered paragraph that follows a
      // completed intention, so a wrapped intention must end in mid-sentence.
      const previous = current[current.length - 1] || '';
      if (/[.!?]["']?$/.test(previous)) {
        flush();
        inConclusion = true;
        conclusionLines.push(line);
        continue;
      }
      current.push(line);
      continue;
    }
    inConclusion = true;
    conclusionLines.push(line);
  }
  flush();

  if (!intentions.length) warnings.push('No numbered intentions were found.');

  const priestConclusion = stripTrailingAmen(squash(conclusionLines));
  if (!priestConclusion) warnings.push('No concluding prayer was found after the intentions.');

  return { title, priestInvitation, responseOptions, intentions, priestConclusion, warnings };
}

export default { parseOrilloPage, stripTrailingResponse, stripTrailingAmen };
