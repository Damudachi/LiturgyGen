/**
 * USCCB cites readings with NAB abbreviations ("Is 25:6-10a", "1 Cor 12:12-14").
 * The USCCB page does NOT carry the lectionary's spoken introduction line, but our
 * missalette prints it above the reading text ("A reading from the Book of the
 * Prophet Isaiah"). This table reconstructs that line from the citation.
 */

const BOOKS = [
  // Pentateuch
  ['gn', 'Genesis', 'A reading from the Book of Genesis'],
  ['ex', 'Exodus', 'A reading from the Book of Exodus'],
  ['lv', 'Leviticus', 'A reading from the Book of Leviticus'],
  ['nm', 'Numbers', 'A reading from the Book of Numbers'],
  ['dt', 'Deuteronomy', 'A reading from the Book of Deuteronomy'],
  // Historical
  ['jos', 'Joshua', 'A reading from the Book of Joshua'],
  ['jgs', 'Judges', 'A reading from the Book of Judges'],
  ['ru', 'Ruth', 'A reading from the Book of Ruth'],
  ['1 sm', '1 Samuel', 'A reading from the first Book of Samuel'],
  ['2 sm', '2 Samuel', 'A reading from the second Book of Samuel'],
  ['1 kgs', '1 Kings', 'A reading from the first Book of Kings'],
  ['2 kgs', '2 Kings', 'A reading from the second Book of Kings'],
  ['1 chr', '1 Chronicles', 'A reading from the first Book of Chronicles'],
  ['2 chr', '2 Chronicles', 'A reading from the second Book of Chronicles'],
  ['ezr', 'Ezra', 'A reading from the Book of Ezra'],
  ['neh', 'Nehemiah', 'A reading from the Book of Nehemiah'],
  ['tb', 'Tobit', 'A reading from the Book of Tobit'],
  ['jdt', 'Judith', 'A reading from the Book of Judith'],
  ['est', 'Esther', 'A reading from the Book of Esther'],
  ['1 mc', '1 Maccabees', 'A reading from the first Book of Maccabees'],
  ['2 mc', '2 Maccabees', 'A reading from the second Book of Maccabees'],
  // Wisdom
  ['jb', 'Job', 'A reading from the Book of Job'],
  ['ps', 'Psalms', 'A reading from the Book of Psalms'],
  ['prv', 'Proverbs', 'A reading from the Book of Proverbs'],
  ['eccl', 'Ecclesiastes', 'A reading from the Book of Ecclesiastes'],
  ['qoh', 'Ecclesiastes', 'A reading from the Book of Ecclesiastes'],
  ['sg', 'Song of Songs', 'A reading from the Song of Songs'],
  ['wis', 'Wisdom', 'A reading from the Book of Wisdom'],
  ['sir', 'Sirach', 'A reading from the Book of Sirach'],
  // Prophets
  ['is', 'Isaiah', 'A reading from the Book of the Prophet Isaiah'],
  ['jer', 'Jeremiah', 'A reading from the Book of the Prophet Jeremiah'],
  ['lam', 'Lamentations', 'A reading from the Book of Lamentations'],
  ['bar', 'Baruch', 'A reading from the Book of the Prophet Baruch'],
  ['ez', 'Ezekiel', 'A reading from the Book of the Prophet Ezekiel'],
  ['dn', 'Daniel', 'A reading from the Book of the Prophet Daniel'],
  ['hos', 'Hosea', 'A reading from the Book of the Prophet Hosea'],
  ['jl', 'Joel', 'A reading from the Book of the Prophet Joel'],
  ['am', 'Amos', 'A reading from the Book of the Prophet Amos'],
  ['ob', 'Obadiah', 'A reading from the Book of the Prophet Obadiah'],
  ['jon', 'Jonah', 'A reading from the Book of the Prophet Jonah'],
  ['mi', 'Micah', 'A reading from the Book of the Prophet Micah'],
  ['na', 'Nahum', 'A reading from the Book of the Prophet Nahum'],
  ['hb', 'Habakkuk', 'A reading from the Book of the Prophet Habakkuk'],
  ['zep', 'Zephaniah', 'A reading from the Book of the Prophet Zephaniah'],
  ['hg', 'Haggai', 'A reading from the Book of the Prophet Haggai'],
  ['zec', 'Zechariah', 'A reading from the Book of the Prophet Zechariah'],
  ['mal', 'Malachi', 'A reading from the Book of the Prophet Malachi'],
  // Gospels
  ['mt', 'Matthew', 'A reading from the holy Gospel according to Matthew'],
  ['mk', 'Mark', 'A reading from the holy Gospel according to Mark'],
  ['lk', 'Luke', 'A reading from the holy Gospel according to Luke'],
  ['jn', 'John', 'A reading from the holy Gospel according to John'],
  // Acts
  ['acts', 'Acts of the Apostles', 'A reading from the Acts of the Apostles'],
  // Pauline letters
  ['rom', 'Romans', 'A reading from the Letter of Saint Paul to the Romans'],
  ['1 cor', '1 Corinthians', 'A reading from the first Letter of Saint Paul to the Corinthians'],
  ['2 cor', '2 Corinthians', 'A reading from the second Letter of Saint Paul to the Corinthians'],
  ['gal', 'Galatians', 'A reading from the Letter of Saint Paul to the Galatians'],
  ['eph', 'Ephesians', 'A reading from the Letter of Saint Paul to the Ephesians'],
  ['phil', 'Philippians', 'A reading from the Letter of Saint Paul to the Philippians'],
  ['col', 'Colossians', 'A reading from the Letter of Saint Paul to the Colossians'],
  ['1 thes', '1 Thessalonians', 'A reading from the first Letter of Saint Paul to the Thessalonians'],
  ['2 thes', '2 Thessalonians', 'A reading from the second Letter of Saint Paul to the Thessalonians'],
  ['1 tm', '1 Timothy', 'A reading from the first Letter of Saint Paul to Timothy'],
  ['2 tm', '2 Timothy', 'A reading from the second Letter of Saint Paul to Timothy'],
  ['ti', 'Titus', 'A reading from the Letter of Saint Paul to Titus'],
  ['phlm', 'Philemon', 'A reading from the Letter of Saint Paul to Philemon'],
  ['heb', 'Hebrews', 'A reading from the Letter to the Hebrews'],
  // Catholic letters
  ['jas', 'James', 'A reading from the Letter of Saint James'],
  ['1 pt', '1 Peter', 'A reading from the first Letter of Saint Peter'],
  ['2 pt', '2 Peter', 'A reading from the second Letter of Saint Peter'],
  ['1 jn', '1 John', 'A reading from the first Letter of Saint John'],
  ['2 jn', '2 John', 'A reading from the second Letter of Saint John'],
  ['3 jn', '3 John', 'A reading from the third Letter of Saint John'],
  ['jude', 'Jude', 'A reading from the Letter of Saint Jude'],
  ['rv', 'Revelation', 'A reading from the Book of Revelation'],
];

/** Alternative spellings USCCB and older lectionaries both emit. */
const ALIASES = {
  gen: 'gn', exod: 'ex', lev: 'lv', num: 'nm', deut: 'dt',
  josh: 'jos', judg: 'jgs', rt: 'ru',
  '1 sam': '1 sm', '2 sam': '2 sm', '1 kings': '1 kgs', '2 kings': '2 kgs',
  '1 chron': '1 chr', '2 chron': '2 chr', ezra: 'ezr',
  tob: 'tb', jth: 'jdt', esth: 'est',
  '1 macc': '1 mc', '2 macc': '2 mc',
  job: 'jb', pss: 'ps', psalm: 'ps', psalms: 'ps',
  prov: 'prv', qo: 'qoh', song: 'sg', cant: 'sg', ws: 'wis',
  isa: 'is', jerem: 'jer', ezek: 'ez', dan: 'dn',
  hab: 'hb', zeph: 'zep', hag: 'hg', zech: 'zec',
  matt: 'mt', mrk: 'mk', luk: 'lk', joh: 'jn',
  ac: 'acts', ro: 'rom', gl: 'gal', ep: 'eph', php: 'phil', cl: 'col',
  '1 thess': '1 thes', '2 thess': '2 thes', '1 tim': '1 tm', '2 tim': '2 tm',
  tit: 'ti', phlmn: 'phlm', jam: 'jas',
  '1 pet': '1 pt', '2 pet': '2 pt', rev: 'rv', apoc: 'rv',
};

const BY_KEY = new Map(BOOKS.map(([key, name, intro]) => [key, { key, name, intro }]));

const GOSPEL_KEYS = new Set(['mt', 'mk', 'lk', 'jn']);

/**
 * Strip chapter/verse from a citation and normalise the book abbreviation.
 * "1 Cor 12:12-14, 27" -> "1 cor"
 */
export function bookKeyFromCitation(citation) {
  if (!citation) return null;
  const cleaned = String(citation)
    .replace(/ /g, ' ')
    .trim()
    .toLowerCase()
    // Keep a leading ordinal ("1 cor", "2 sm") plus the alphabetic book name,
    // and drop the chapter/verse tail.
    .replace(/^(\d\s*)?([a-z\s.]+).*$/, (_, ord, name) => (ord ? `${ord.trim()} ` : '') + name)
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (BY_KEY.has(cleaned)) return cleaned;
  if (ALIASES[cleaned]) return ALIASES[cleaned];

  // Longest-prefix fallback for citations with trailing words we did not model.
  const candidates = [...BY_KEY.keys(), ...Object.keys(ALIASES)]
    .filter((key) => cleaned.startsWith(key))
    .sort((a, b) => b.length - a.length);
  if (candidates.length) return ALIASES[candidates[0]] ?? candidates[0];
  return null;
}

export function bookFromCitation(citation) {
  const key = bookKeyFromCitation(citation);
  return key ? BY_KEY.get(key) : null;
}

/**
 * The introduction line printed above a reading. Returns null when the book
 * cannot be identified, so callers can leave the line out rather than print
 * something wrong in a liturgical book.
 */
export function readingIntroLine(citation) {
  const book = bookFromCitation(citation);
  return book ? book.intro : null;
}

export function isGospelCitation(citation) {
  const key = bookKeyFromCitation(citation);
  return key != null && GOSPEL_KEYS.has(key);
}

export function bookName(citation) {
  const book = bookFromCitation(citation);
  return book ? book.name : null;
}

/** "1 cor" -> "1 Cor", "is" -> "Is" - the abbreviation as our missalette prints it. */
export function citationAbbrev(key) {
  if (!key) return null;
  return key
    .split(' ')
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

const BY_NAME = new Map(BOOKS.map(([key, name]) => [name.toLowerCase(), key]));

/**
 * Resolve a spelled-out book name to our key. Sources other than USCCB write
 * names out in full ("First Letter to the Corinthians", "Book of the Prophet
 * Isaiah", "Holy Gospel of Jesus Christ according to Saint Luke"), so strip the
 * decorative wording and normalise the ordinal before matching.
 */
export function bookKeyFromName(rawName) {
  if (!rawName) return null;

  let name = String(rawName).toLowerCase().replace(/\s+/g, ' ').trim();

  const ordinals = { first: '1', second: '2', third: '3', i: '1', ii: '2', iii: '3' };
  let ordinal = '';
  const ordinalMatch = name.match(/^(first|second|third|i{1,3}|[123])\b\s*/);
  if (ordinalMatch) {
    const token = ordinalMatch[1];
    ordinal = ordinals[token] || token;
    name = name.slice(ordinalMatch[0].length);
  }

  name = name
    .replace(/^(the\s+)?holy gospel( of jesus christ)? according to (saint\s+)?/, '')
    .replace(/^(the\s+)?gospel according to (saint\s+)?/, '')
    .replace(/^(the\s+)?(book|letter|epistle|prophecy)\s+(of|to)\s+/, '')
    .replace(/^the\s+/, '')
    .replace(/^prophet\s+/, '')
    .replace(/^saint\s+/, '')
    .replace(/^acts of the apostles$/, 'acts of the apostles')
    .trim();

  const candidates = ordinal ? [`${ordinal} ${name}`, name] : [name, `1 ${name}`];
  for (const candidate of candidates) {
    if (BY_NAME.has(candidate)) return BY_NAME.get(candidate);
    if (BY_KEY.has(candidate)) return candidate;
    if (ALIASES[candidate]) return ALIASES[candidate];
  }
  return null;
}
