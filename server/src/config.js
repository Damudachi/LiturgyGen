import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

/**
 * Where the office's own data lives: the database and the saved readings. The
 * installed app points this outside the program folder, so reinstalling or
 * updating LiturgyGen never touches the prayers and corrections. Unset, a
 * development checkout keeps using server/data and server/.cache.
 */
const DATA_DIR = process.env.LITURGYGEN_DATA_DIR || null;


export const config = {
  port: Number(process.env.PORT || 4000),
  /** Unset listens everywhere; the installed app listens on this computer only. */
  host: process.env.HOST || undefined,
  dbFile: process.env.DB_FILE || path.join(DATA_DIR || path.join(ROOT, 'data'), 'liturgygen.sqlite'),

  usccb: {
    baseUrl: 'https://bible.usccb.org/bible/readings',
    // USCCB blocks aggressive clients. Never lower these without reason.
    delayMs: Number(process.env.USCCB_DELAY_MS || 800),
    timeoutMs: Number(process.env.USCCB_TIMEOUT_MS || 20000),
    maxRetries: 3,
    // How long to leave USCCB completely alone after it serves its bot check.
    // Requests made while the block is up renew it, so a batch that keeps asking
    // never gets back in. Measured against the live site: after a couple of
    // minutes untouched, it serves again.
    challengeCooldownMs: Number(process.env.USCCB_COOLDOWN_MS || 180000),
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    cacheDir: path.join(DATA_DIR ? path.join(DATA_DIR, 'cache') : path.join(ROOT, '.cache'), 'usccb'),
    cacheEnabled: process.env.USCCB_CACHE !== 'false',
  },

  calendar: {
    // Particular calendar for the Dioceses of the Philippines.
    particularCalendar: process.env.ROMCAL_CALENDAR || 'philippines',
    locale: 'en',
    epiphanyOnSunday: true,
    ascensionOnSunday: true,
    corpusChristiOnSunday: true,
  },
};

export default config;
