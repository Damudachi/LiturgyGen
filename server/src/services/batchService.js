/**
 * batchService - runs a multi-date generation as a tracked job.
 *
 * Dates are processed strictly one at a time. That is not a simplification: the
 * whole reason batch generation needs a job at all is that hammering the
 * readings source in parallel gets the office's IP challenged or blocked. The
 * per-request spacing lives in the provider queues; this layer adds progress
 * reporting, cancellation, and per-date error isolation so one bad day does not
 * lose the other twenty-one.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { formatLongDate, readingsFileName, sortUnique } from '../lib/dates.js';
import { sleep } from '../lib/httpQueue.js';
import { buildDay, styleFromSettings } from './compositionService.js';
import { buildCombinedDocx, buildDayDocx } from './docxService.js';
import { preferredCooldownMs } from './scraperService.js';
import { getSettings } from '../db/index.js';

const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs for an hour

/**
 * The most a single run will spend waiting for the readings source to let us
 * back in. A bot check costs about three minutes and a month of weekdays takes
 * fifteen seconds to generate, so a couple of waits buys a complete set - but if
 * the source is simply down we stop holding the office up and let the fallback
 * finish the run.
 */
const MAX_WAIT_MS = 15 * 60 * 1000;

const jobs = new Map();

export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(0);

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    /** Documents that were produced but still need a line typed in by hand. */
    needsAttention: job.results.filter((result) => result.ok && result.warnings.length).length,
    currentIndex: job.currentIndex,
    currentDate: job.currentDate,
    message: job.message,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    dates: job.dates,
    results: job.results.map((result) => ({
      date: result.date,
      ok: result.ok,
      fileName: result.fileName,
      occasionTitle: result.occasionTitle,
      warnings: result.warnings,
      error: result.error,
    })),
    error: job.error,
  };
}

function emit(job) {
  jobEvents.emit(job.id, publicJob(job));
  jobEvents.emit('any', publicJob(job));
}

function sweep() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && new Date(job.finishedAt).getTime() < cutoff) jobs.delete(id);
  }
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

export function listJobs() {
  sweep();
  return [...jobs.values()]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .map(publicJob);
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job || job.status !== 'running') return false;
  job.cancelRequested = true;
  job.message = 'Cancelling after the current date…';
  emit(job);
  return true;
}

/** The generated .docx buffers of a finished job, in date order. */
export function jobDocuments(id) {
  const job = jobs.get(id);
  if (!job) return null;
  return job.results.filter((result) => result.ok);
}

/**
 * Start a batch. Returns immediately with the job record; progress arrives via
 * `jobEvents` (the SSE endpoint) or by polling `getJob`.
 */
export function startBatch(dates, options = {}) {
  sweep();

  const unique = sortUnique(dates);
  if (!unique.length) {
    const err = new Error('Select at least one date to generate.');
    err.status = 400;
    throw err;
  }
  if (unique.length > 200) {
    const err = new Error(`That batch has ${unique.length} dates. Generate at most 200 at a time.`);
    err.status = 400;
    throw err;
  }

  const settings = getSettings();
  const job = {
    id: randomUUID(),
    status: 'running',
    dates: unique,
    total: unique.length,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    currentDate: null,
    message: 'Starting…',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    results: [],
    error: null,
    /** Total time this run has spent held off the readings source, capped. */
    waitedMs: 0,
    cancelRequested: false,
    options,
    settings,
  };
  jobs.set(job.id, job);

  // Deliberately not awaited: the caller gets the job id straight away.
  run(job).catch((error) => {
    job.status = 'failed';
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    emit(job);
  });

  return publicJob(job);
}

/**
 * Hold the run while the readings source is cooling off after its bot check.
 *
 * USCCB's block lasts minutes; a month of weekdays generates in seconds. So the
 * first challenge used to decide the whole run - every remaining date came from
 * the fallback feed, which publishes no psalm response and no Gospel
 * Acclamation, and the office got twenty documents with two lines missing from
 * each. Waiting a few minutes for the real source is the trade the office
 * actually wants, and it is paid once: the pages are cached permanently after.
 *
 * The wait is interruptible - Cancel still lands within a second - and capped,
 * so a source that is genuinely down cannot stall the run indefinitely.
 */
async function waitForPreferredSource(job) {
  let remaining = preferredCooldownMs(job.options.providers);
  if (remaining <= 0) return;

  while (remaining > 0 && !job.cancelRequested && job.waitedMs < MAX_WAIT_MS) {
    const seconds = Math.ceil(remaining / 1000);
    job.message =
      `Waiting ${seconds}s for the readings source to let us back in - it asked us to ` +
      'slow down. The batch resumes on its own.';
    emit(job);

    const slice = Math.min(remaining, 1000);
    await sleep(slice);
    job.waitedMs += slice;
    remaining = preferredCooldownMs(job.options.providers);
  }
}

async function run(job) {
  const style = styleFromSettings(job.settings, job.options.style || {});

  for (let index = 0; index < job.dates.length; index += 1) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.message = `Cancelled after ${job.completed} of ${job.total} dates.`;
      job.finishedAt = new Date().toISOString();
      emit(job);
      return;
    }

    const date = job.dates[index];
    job.currentIndex = index + 1;
    job.currentDate = date;

    await waitForPreferredSource(job);
    if (job.cancelRequested) continue;

    job.message = `Processing date ${index + 1} of ${job.total}: ${formatLongDate(date)}…`;
    emit(job);

    try {
      const day = await buildDay(date, {
        force: job.options.force,
        providers: job.options.providers,
        extraIntentions: job.options.extraIntentions ?? job.settings.schoolWideIntentions,
        settings: job.settings,
      });

      if (day.readingsError) throw new Error(day.readingsError.message);

      const buffer = await buildDayDocx(day, style);

      job.results.push({
        date,
        ok: true,
        fileName: readingsFileName(date),
        occasionTitle: day.occasionTitle,
        warnings: day.warnings,
        buffer,
        day,
        error: null,
      });
      job.completed += 1;
    } catch (error) {
      job.results.push({
        date,
        ok: false,
        fileName: null,
        occasionTitle: null,
        warnings: [],
        buffer: null,
        day: null,
        error: error.message,
      });
      job.failed += 1;
    }

    emit(job);
  }

  await fillGaps(job, style);

  job.status = job.failed === job.total ? 'failed' : 'done';
  job.currentDate = null;
  job.message = summarise(job);
  job.finishedAt = new Date().toISOString();
  emit(job);
}

/**
 * Second pass over the days that came out thin.
 *
 * A day filled from the fallback feed has no psalm response and no Gospel
 * Acclamation. Usually that is not the day's fault - it is simply the day that
 * was being fetched when USCCB asked us to slow down. By the time the run
 * reaches the end the cooldown has lapsed, so each of those days is worth one
 * more ask before we hand the office a document with two lines missing.
 *
 * Nothing here is forced, so this pass is cheap. A day the preferred source
 * already supplied is settled in the cache and comes straight back without a
 * request, genuine gaps included - Good Friday really has no Gospel
 * Acclamation. Only the fallback's days go out again, and one that comes back no
 * better keeps the copy it has.
 */
async function fillGaps(job, style) {
  const thin = job.results.filter((result) => result.ok && result.warnings.length);
  if (!thin.length) return;

  for (const [index, result] of thin.entries()) {
    if (job.cancelRequested || job.waitedMs >= MAX_WAIT_MS) return;

    await waitForPreferredSource(job);
    if (job.cancelRequested) return;

    job.currentDate = result.date;
    job.message =
      `Filling the gaps: ${formatLongDate(result.date)} (${index + 1} of ${thin.length}) ` +
      'is missing lines the fallback feed does not carry.';
    emit(job);

    try {
      const day = await buildDay(result.date, {
        providers: job.options.providers,
        extraIntentions: job.options.extraIntentions ?? job.settings.schoolWideIntentions,
        settings: job.settings,
      });
      if (day.readingsError || day.warnings.length >= result.warnings.length) continue;

      result.buffer = await buildDayDocx(day, style);
      result.warnings = day.warnings;
      result.occasionTitle = day.occasionTitle;
      result.day = day;
    } catch {
      /* keep the copy we already have; it prints, it just needs a line typed in */
    }

    emit(job);
  }
}

/**
 * What to tell the office when the run ends.
 *
 * The case worth naming is the quiet one: USCCB served its bot check partway
 * through, the remaining dates came from the fallback feed, and those documents
 * are missing their psalm response and Gospel Acclamation. That used to read as
 * a wall of identical amber warnings with nothing saying what to do about it.
 * The answer is simply to run the same batch again later - dates already fetched
 * are cached, and only the thin ones go back out to USCCB.
 */
function summarise(job) {
  const parts = [];

  if (job.failed === 0) parts.push(`Generated all ${job.completed} documents.`);
  else parts.push(`Generated ${job.completed} of ${job.total} documents; ${job.failed} could not be built.`);

  const thin = job.results.filter((result) => result.ok && result.warnings.length).length;
  if (thin) {
    parts.push(
      `${thin} ${thin === 1 ? 'day is' : 'days are'} missing something - most often the psalm ` +
        'response and Gospel Acclamation, which the fallback feed does not publish. Run this same ' +
        'batch again in a few minutes and those days will be re-fetched from USCCB; the rest are ' +
        'already cached and will not be downloaded twice.',
    );
  }

  return parts.join(' ');
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

/** Option A: every document zipped, streamed so nothing large sits in memory. */
export function zipStreamFor(id) {
  const documents = jobDocuments(id);
  if (!documents) return null;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  for (const document of documents) {
    archive.append(document.buffer, { name: document.fileName });
  }

  const failed = jobs.get(id).results.filter((result) => !result.ok);
  if (failed.length) {
    const report = failed.map((result) => `${result.date}\t${result.error}`).join('\r\n');
    archive.append(
      `These dates could not be generated:\r\n\r\n${report}\r\n`,
      { name: 'NOT-GENERATED.txt' },
    );
  }

  archive.finalize();
  return stream;
}

/** Option B: one master document, each date on its own page. */
export async function combinedDocxFor(id) {
  const job = jobs.get(id);
  if (!job) return null;
  const days = job.results.filter((result) => result.ok).map((result) => result.day);
  if (!days.length) return null;
  const style = styleFromSettings(job.settings, job.options.style || {});
  return buildCombinedDocx(days, style);
}

export default {
  startBatch,
  getJob,
  listJobs,
  cancelJob,
  jobDocuments,
  zipStreamFor,
  combinedDocxFor,
  jobEvents,
};
