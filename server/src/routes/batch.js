import { Router } from 'express';
import { isIsoDate, monthName, sortUnique } from '../lib/dates.js';
import batchService, { jobEvents } from '../services/batchService.js';

const router = Router();

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Start a batch.
 * Body: { dates: ["2026-10-01", ...], extraIntentions?, style?, force?, providers? }
 */
router.post('/', (req, res, next) => {
  try {
    const { dates, ...options } = req.body || {};
    if (!Array.isArray(dates)) return res.status(400).json({ error: 'Provide "dates" as an array of YYYY-MM-DD strings.' });

    const invalid = dates.filter((date) => !isIsoDate(date));
    if (invalid.length) {
      return res.status(400).json({ error: `These are not valid dates: ${invalid.slice(0, 5).join(', ')}` });
    }

    res.status(202).json(batchService.startBatch(sortUnique(dates), options));
  } catch (error) {
    next(error);
  }
});

router.get('/', (_req, res) => res.json({ jobs: batchService.listJobs() }));

router.get('/:id', (req, res) => {
  const job = batchService.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'That batch is no longer available.' });
  res.json(job);
});

router.post('/:id/cancel', (req, res) => {
  res.json({ cancelled: batchService.cancelJob(req.params.id) });
});

/**
 * Live progress over Server-Sent Events: "Processing date 4 of 22: October 6, 2026…"
 * SSE rather than WebSockets - one-way, reconnects on its own, no extra dependency.
 */
router.get('/:id/events', (req, res) => {
  const job = batchService.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'That batch is no longer available.' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  send(job);

  const onUpdate = (payload) => {
    send(payload);
    if (['done', 'failed', 'cancelled'].includes(payload.status)) {
      clearInterval(heartbeat);
      res.end();
    }
  };

  // Comment frames keep proxies and the browser from closing an idle stream.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  jobEvents.on(req.params.id, onUpdate);
  req.on('close', () => {
    clearInterval(heartbeat);
    jobEvents.off(req.params.id, onUpdate);
  });
});

/** Option A - every document in one .zip. */
router.get('/:id/zip', (req, res, next) => {
  try {
    const job = batchService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'That batch is no longer available.' });
    if (job.status === 'running') return res.status(409).json({ error: 'The batch is still running.' });

    const stream = batchService.zipStreamFor(req.params.id);
    if (!stream) return res.status(404).json({ error: 'That batch produced no documents.' });

    const first = job.dates[0];
    const [year, month] = first.split('-');
    const fileName = `Mass-Readings-${monthName(Number(month))}-${year}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    stream.pipe(res);
    stream.on('error', next);
  } catch (error) {
    next(error);
  }
});

/** Option B - one master document, one page per date. */
router.get('/:id/combined', async (req, res, next) => {
  try {
    const job = batchService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'That batch is no longer available.' });
    if (job.status === 'running') return res.status(409).json({ error: 'The batch is still running.' });

    const buffer = await batchService.combinedDocxFor(req.params.id);
    if (!buffer) return res.status(404).json({ error: 'That batch produced no documents.' });

    const first = job.dates[0];
    const [year, month] = first.split('-');
    const fileName = `Mass-Readings-${monthName(Number(month))}-${year}.docx`;

    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
