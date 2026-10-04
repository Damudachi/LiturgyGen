/**
 * Demo mode: the same API surface as httpApi.js, answered inside the browser.
 *
 * This exists so the GitHub Pages build is a working link before the Express
 * API is deployed anywhere, and so there is something to show if a free tier is
 * asleep during a demo. It is a stand-in, not a second implementation of
 * LiturgyGen: the liturgical calendar is a snapshot, not romcal; the readings
 * are citations without their text; and anything that would produce a Word file
 * says plainly that it needs the real API.
 *
 * `seed.json` is built by `node server/tools/build-demo-seed.mjs`, which
 * deliberately strips two things before writing a file that is committed to a
 * public repository: the scripture text (New American Bible, copyright USCCB
 * and the CCD) and the office's own transcribed prayers. Both are somebody
 * else's to distribute, not ours.
 *
 * What the office types here is kept in localStorage, so it survives a reload
 * and is visible to nobody else. Every read merges the seed with those edits.
 */

import seed from './seed.json';

const STORE = 'liturgygen-demo-v1';

/** The shape of everything the demo lets a visitor change. */
const EMPTY = { templates: [], deleted: [], settings: {}, schedule: [], overrides: {}, nextId: 1000 };

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    // Private windows and blocked site data both land here. The demo still
    // works; it just forgets between reloads.
    return { ...EMPTY };
  }
}

function save(state) {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* nothing to do: the demo is still usable, it just will not remember */
  }
  return state;
}

function edit(fn) {
  const state = load();
  const result = fn(state);
  save(state);
  return result;
}

/** Demo calls resolve on a timer so loading states are visible rather than skipped. */
const settle = (value, ms = 120) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

function demoError(what) {
  const error = new Error(`${what} needs the real API. This deployment is running in demo mode.`);
  error.code = 'DEMO_MODE';
  error.hint = 'Run the server locally, or install the desktop build, to produce Word files.';
  return error;
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

function allTemplates() {
  const state = load();
  const byId = new Map(seed.templates.map((template) => [template.id, template]));
  for (const template of state.templates) byId.set(template.id, template);
  for (const id of state.deleted) byId.delete(id);
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function findTemplate(id) {
  const template = allTemplates().find((item) => item.id === Number(id));
  if (!template) throw new Error('That prayer no longer exists.');
  return template;
}

/* ------------------------------------------------------------------ *
 * Days
 * ------------------------------------------------------------------ */

function monthDays(year, month) {
  return seed.months[`${year}-${month}`] || [];
}

function dayFor(iso) {
  for (const days of Object.values(seed.months)) {
    const match = days.find((day) => day.date === iso);
    if (match) return match;
  }
  return null;
}

/** The composed day the book renders: liturgy + readings + prayers. */
function composeDay(iso, { potfTemplateId = null } = {}) {
  const day = dayFor(iso);
  if (!day) {
    const error = new Error(`${iso} is outside the demo data. September and October 2026 are seeded.`);
    error.code = 'DEMO_RANGE';
    throw error;
  }

  const preview = seed.previews[iso] || {};
  const readings = load().overrides[iso] || seed.readings[iso] || null;

  const chosen = potfTemplateId
    ? allTemplates().find((template) => template.id === Number(potfTemplateId))
    : allTemplates().find((template) => template.season === day.potfLookup?.ferialSeason)
      || allTemplates().find((template) => template.season === 'Ordinary Time');

  const warnings = [];
  if (!readings) warnings.push('No readings are seeded for this date in demo mode.');
  if (chosen?.isPlaceholder) {
    warnings.push('These are placeholder prayers written for this tool, not from the General Intercessions books.');
  }

  return {
    date: iso,
    headerDate: day.headerDate,
    fileName: preview.fileName || `READINGS-${iso}.docx`,
    occasionTitle: day.occasionTitle,
    potfTitle: chosen ? chosen.title.toUpperCase() : null,
    liturgy: preview.liturgy || day,
    readings,
    readingsError: readings ? null : { code: 'DEMO_MODE', message: 'Not seeded in demo mode.' },
    potf: chosen
      ? {
        templateId: chosen.id,
        title: chosen.title,
        priestInvitation: chosen.priestInvitation,
        responseOptions: chosen.responseOptions,
        intentions: chosen.intentions,
        priestConclusion: chosen.priestConclusion,
      }
      : null,
    potfMatch: chosen ? 'demo' : null,
    warnings,
    isComplete: Boolean(readings && chosen),
  };
}

/* ------------------------------------------------------------------ *
 * The surface. Every key here also exists in httpApi.js.
 * ------------------------------------------------------------------ */

export const api = {
  health: () => settle({ ok: true, service: 'LiturgyGen', demo: true }),

  // Calendar
  month: (year, month) =>
    settle({ year, month, days: monthDays(year, month) }),
  day: (date) => settle(dayFor(date) || Promise.reject(new Error('Not in the demo data.'))),
  expand: ({ year, month, mode = 'weekdays', weekdays }) => {
    const days = monthDays(year, month);
    const wanted = mode === 'all'
      ? null
      : new Set(Array.isArray(weekdays) && weekdays.length ? weekdays.map(Number) : [1, 2, 3, 4, 5]);
    const dates = days
      .filter((day) => !wanted || wanted.has(new Date(`${day.date}T00:00:00Z`).getUTCDay()))
      .map((day) => day.date);
    return settle({ year, month, mode, dates });
  },

  // Readings
  readings: (date) => settle(seed.readings[date] || Promise.reject(demoError('Fetching readings'))),
  fullDay: (date) => settle(composeDay(date)),
  saveReadings: (date, patch) =>
    settle(edit((state) => {
      state.overrides[date] = patch;
      return { saved: true };
    })),
  clearOverride: (date) =>
    settle(edit((state) => {
      delete state.overrides[date];
      return { cleared: true };
    })),
  importReadings: () => Promise.reject(demoError('Importing a USCCB page')),
  clearCache: () => settle({ cleared: 0 }),
  providers: () => settle({ providers: [{ id: 'demo', label: 'Seeded demo data', available: true }] }),
  checkDays: (dates) =>
    settle({
      days: dates.map((date) => {
        const has = Boolean(seed.readings[date] || load().overrides[date]);
        return {
          date,
          hasReadings: has,
          hasPsalmResponse: has,
          hasAcclamation: has,
          hasPotf: true,
          issues: has ? [] : ['No readings seeded for this date in demo mode.'],
        };
      }),
    }),

  // Generation
  preview: ({ date, potfTemplateId }) => {
    try {
      return settle(composeDay(date, { potfTemplateId }));
    } catch (error) {
      return Promise.reject(error);
    }
  },
  generate: () => Promise.reject(demoError('Downloading a Word file')),

  // Batch
  startBatch: () => Promise.reject(demoError('Making Word files for several days')),
  batch: () => Promise.reject(demoError('Batch progress')),
  cancelBatch: () => settle({ cancelled: true }),
  // Demo mode rejects startBatch, so nothing ever reaches the stream.
  // It exists so the shape of the two modules stays the same.
  streamBatch: () => () => {},
  importExtract: () => Promise.reject(demoError('Importing a prayer book')),
  importCommit: () => Promise.reject(demoError('Importing a prayer book')),
  downloadZip: () => Promise.reject(demoError('Downloading a ZIP')),
  downloadCombined: () => Promise.reject(demoError('Downloading a combined document')),

  // Prayers of the Faithful
  potfMeta: () => settle({ seasons: seed.seasons }),
  potfList: () => settle({ templates: allTemplates() }),
  potfResolve: (date) => settle({ template: composeDay(date).potf }),
  potfCreate: (body) =>
    settle(edit((state) => {
      const template = { ...body, id: state.nextId++, origin: 'custom', isPlaceholder: false, isActive: true };
      state.templates.push(template);
      return template;
    })),
  potfUpdate: (id, body) =>
    settle(edit((state) => {
      const template = { ...findTemplate(id), ...body, id: Number(id) };
      state.templates = state.templates.filter((item) => item.id !== Number(id)).concat(template);
      return template;
    })),
  potfDuplicate: (id) =>
    settle(edit((state) => {
      const copy = { ...findTemplate(id), id: state.nextId++, title: `${findTemplate(id).title} (copy)`, origin: 'custom', isPlaceholder: false };
      state.templates.push(copy);
      return copy;
    })),
  potfDelete: (id) =>
    settle(edit((state) => {
      state.deleted.push(Number(id));
      state.templates = state.templates.filter((item) => item.id !== Number(id));
      return { deleted: true };
    })),
  potfParse: () => Promise.reject(demoError('Parsing a typed-in prayer page')),
  potfImport: () => Promise.reject(demoError('Importing a prayer page')),

  // Settings & schedule
  // Demo mode has no accounts: the whole point is that it opens without one.
  // `authDisabled` is the same shape the real API sends when Supabase is not
  // configured, so App.jsx takes one path for both and the demo never renders
  // a half-signed-in state.
  account: () => settle({ authDisabled: true, user: null, organisation: null, organisations: [] }),
  createOrganisation: () => Promise.reject(demoError('Creating a parish')),

  settings: () =>
    settle({ settings: { ...seed.settings, ...load().settings }, defaults: seed.defaults, style: seed.style }),
  saveSettings: (body) =>
    settle(edit((state) => {
      state.settings = { ...state.settings, ...body };
      return { settings: { ...seed.settings, ...state.settings } };
    })),
  schedule: () => settle({ scheduled: [...seed.schedule, ...load().schedule] }),
  addSchedule: ({ dates, label = null }) =>
    settle(edit((state) => {
      const list = Array.isArray(dates) ? dates : [dates];
      for (const date of list) {
        if (!state.schedule.some((row) => row.date === date)) state.schedule.push({ date, label, notes: null });
      }
      return { added: list };
    })),
  removeSchedule: (date) =>
    settle(edit((state) => {
      state.schedule = state.schedule.filter((row) => row.date !== date);
      return { deleted: true };
    })),
};

export default api;
