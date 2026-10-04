/**
 * Importing a parish's own prayer book: upload, review, commit.
 *
 *   POST /api/potf/import/extract   a PDF or an image -> drafts, saved nowhere
 *   POST /api/potf/import/commit    the drafts somebody approved -> rows
 *
 * Behind `requireAuth` with the rest of /api, so an upload always knows which
 * parish it is for and a draft can never land in somebody else's library.
 *
 * WHY THE UPLOAD IS A RAW BODY AND NOT MULTIPART
 * ----------------------------------------------
 * One file per request, sent as its own bytes with its own Content-Type. That
 * needs `express.raw` and nothing else; multipart would mean another dependency
 * parsing attacker-controlled input for the sake of a form field this does not
 * have. The client sends one file at a time, which it has to anyway - a review
 * screen for two books at once is not a thing anybody wants.
 *
 * The size cap is here rather than in the service because it belongs to the
 * transport: a body too large should be refused before it is read into memory,
 * not after.
 */

import { Router } from 'express';
import express from 'express';
import { extract, MAX_PAGES } from '../services/importService.js';
import { createTemplate } from '../services/potfService.js';

const router = Router();

/** A scanned book is big. A book that is 40 MB is somebody's mistake. */
const MAX_UPLOAD = '40mb';

router.post(
  '/extract',
  express.raw({ type: ['application/pdf', 'image/*'], limit: MAX_UPLOAD }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({
          error: 'Send the file as its own body, with Content-Type application/pdf or image/*.',
        });
      }
      const result = await extract(req.body, req.get('content-type'));
      res.json({
        how: result.how,
        drafts: result.drafts,
        // The client says "nothing has been saved yet" on the strength of this,
        // so it is part of the contract rather than a nicety.
        saved: false,
        maxPages: MAX_PAGES,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Save the drafts the office ticked.
 *
 * Each one goes through `createTemplate`, which is the same door the typing
 * screen uses - so an imported prayer is validated and normalised exactly like
 * a typed one, and there is no second definition of what a valid template is.
 *
 * One failure does not sink the request. A hundred-page import where page 58
 * has an empty title should save the other ninety-nine and say which one it
 * could not, rather than rolling back an afternoon of reviewing.
 */
router.post('/commit', async (req, res, next) => {
  try {
    const drafts = Array.isArray(req.body && req.body.prayers) ? req.body.prayers : null;
    if (!drafts || !drafts.length) {
      return res.status(400).json({ error: 'Tick at least one prayer to save it.' });
    }
    if (drafts.length > MAX_PAGES) {
      return res.status(400).json({ error: `Save at most ${MAX_PAGES} prayers at a time.` });
    }

    const saved = [];
    const failed = [];
    for (const draft of drafts) {
      try {
        const template = await createTemplate(req.orgId, {
          ...draft,
          // Imported rather than seeded: `origin` is what tells the seeder to
          // leave these alone when it next refreshes the placeholders.
          origin: 'import',
        });
        saved.push({ id: template.id, title: template.title });
      } catch (error) {
        failed.push({ title: draft && draft.title, error: error.message });
      }
    }

    res.status(saved.length ? 201 : 400).json({ saved, failed });
  } catch (error) {
    next(error);
  }
});

export default router;
