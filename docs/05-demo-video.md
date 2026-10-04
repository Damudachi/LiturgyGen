# 5. Demo video

**Link:** not recorded yet. Due in week 3.

Three to five minutes, face and voice, as a public Google Drive link. The rubric
gives 60 of the presentation's 100 points to this, for walking through the app
**and the code** and explaining the choices — not for production polish.

## Plan

Target 4:35, which leaves room to breathe inside a five-minute cap. Times are
cumulative, so if a section runs long the next one absorbs it.

| Time | What is on screen | What I say |
| --- | --- | --- |
| 0:00–0:25 | the office's printed missalette beside a blank Word document | The problem. One Mass needs the ORDO checked, the readings fetched from USCCB, the formatting rebuilt, and the right page found in two volumes of intercessions. The office does that twenty-plus times a month, by hand. |
| 0:25–0:55 | type `liturgygen.onrender.com` live; landing page, then the sign-in prompt, then the app | It is deployed and it is private. The landing page is the only thing outside the gate — a fixed string, no data. Everything else, including all nineteen write routes, is behind HTTP Basic Auth, because an open `DELETE` on a public URL gets found by a scanner, not by a person. |
| 0:55–1:35 | the Calendar; click 8 September | The month in its liturgical colours. Click a day and it opens as a book: what the day keeps on the left, the missalette exactly as it will print on the right. |
| 1:35–2:15 | "Select several days" → the weekdays → the making panel | A batch. Three days are flagged *before* anything is produced — a missing psalm response, no prayers on file — and they are listed first, so they get fixed rather than printed wrong. |
| 2:15–2:55 | `services/potfService.js`, the `resolveForDay` cascade | **The part I wrote, and why.** Seven tiers, most specific first: celebration, then calendar date — because the book keys 17–24 December to dates, not to liturgical weeks — then season and week and weekday, then the Ordinary Time book for the same weekday. That last fallback is what a naive matcher gets wrong: a day with no page of its own does not get nothing, it gets the Ordinary Time page. I worked the order out by watching the office flip through the two volumes. |
| 2:55–3:30 | `providers/usccbProvider.js` and `lib/httpQueue.js` | USCCB serves a bot check. The decision I am most pleased with is *not* defeating it: I measured it instead, found that requests made while blocked renew the block, and so the client keeps the cookie and then leaves the site alone for three minutes. Going slower did not help; going quiet did. |
| 3:30–4:05 | `db/schema.sql`, the `readings_cache` table, then `/readyz` answering | PostgreSQL, and I want to be straight that this migration was AI-assisted — it is disclosed in `AI-USAGE.md`. What I understand from it is the part that caught me out: the readings cache was still files on disk, and a free host's filesystem is wiped on every restart, so the thing the whole app's speed depends on had to become a table. A fetched day is now one query, forever. |
| 4:05–4:35 | the generated `.docx` open in Word beside the office's original | The point of all of it. Same geometry — Book Antiqua, those four margins, the citation flush right on the heading line — produced in a second instead of an evening. |

## What to say about AI, on camera

Say it plainly and move on; it is disclosed in `AI-USAGE.md` and the badge
rewards honesty over a tidy story. One sentence at the PostgreSQL slide is
enough: the migration and the credential check were AI-written, the liturgical
logic and the parsers are mine, and the thing I learned was the ephemeral
filesystem trap that made the cache a table. Do not oversell authorship of code
the git history can contradict.

## Checklist before recording

- [ ] **Real API, not demo mode** — the demo notice must not be on screen. Record
      against `liturgygen.onrender.com`, not GitHub Pages
- [ ] **Warm the cache first.** Run a batch over the dates you will demo *before*
      recording. A cold date costs a live fetch and possibly three minutes of
      cooldown, on camera
- [ ] **Wake the service first.** The free tier spins down after 15 idle minutes
      and takes about a minute to start. Load the page once before you hit record
- [ ] **Nothing secret in frame.** No `.env`, no terminal history, no Render
      environment panel, no Neon dashboard, no connection string. When the
      sign-in prompt appears, let the browser fill it or type it off-camera —
      the password is in the private project README, not in the video
- [ ] The Prayers screen may show prayer **titles**; never scroll a prayer body
      into frame, because the books are copyrighted
- [ ] No real name other than mine anywhere on screen
- [ ] Recorded at 1440×900 so the two-page book layout fits
- [ ] Watch it back once with sound, for the cuts where the app was still loading
