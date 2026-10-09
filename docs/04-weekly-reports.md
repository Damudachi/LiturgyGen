# Weekly reports

Newest at the top. Never edit an old one.

---

## Week of 2026-10-06

**Done.** Week 3's two deferred security items, which the week-2 checklist had
named as "they become real the day the API sits on a public URL". It did, so
they did.

`helmet` is in, with the Content-Security-Policy written out rather than left at
the default or switched off: `styleSrc` allows `'unsafe-inline'` because Tailwind
injects a stylesheet at run time, `scriptSrc` does not, and `connect-src` is
derived from `SUPABASE_URL` instead of hardcoded. It has a test —
`server/test/csp.test.js` — because the way a too-tight policy fails is the
worst kind: the browser blocks every sign-in request before it leaves the page,
`fetch` rejects with "Failed to fetch", and **nothing reaches a server log at
all**. There is no trace to debug from, so the policy gets an assertion instead.
`express-rate-limit` is on `/api` at 600 requests a minute, applied after the
gate so a signed-in office is counted separately from anonymous traffic at the
door, and off under `NODE_ENV=test`.

The phone layout. The navbar's four tabs move to a fixed bottom bar below 768px
and each gains a mark; below 640px a day tile sheds everything that is not the
date and the liturgical colour. The two bars are now one pair of custom
properties, `--app-header` and `--app-nav`, because the day book has to clear
both and the heights were previously literals written out in two files — a
`top-[60px]` that was a silent promise about a number in `App.jsx`.

`SECURITY-CHECKLIST.md` was written against the announcement's four sections,
with the evidence command for every row.

**What broke, and what it cost.** Nothing broke. What went wrong is that the
documentation stopped tracking the code, in both directions, and neither
direction was visible from inside the repository:

- `docs/06` still listed `helmet` and rate limiting as open, for eight days
  after both shipped. `helmet` landed in the *same commit* as the PostgreSQL
  migration, on the same day the checklist was written saying it had not.
- The mobile work touched nine files and **no document at all**, so the screen
  map had no bottom bar in it and the design system's breakpoint table was
  missing the two breakpoints the work added.
- `docs/06` claimed "eighteen commits" carry a personal author email and that
  every commit since the switch carries the noreply address. Counted properly:
  **25 of 53**, and seven of those are dated 2026-10-04, after the switch. The
  local git config was never wrong — those seven are edits made through
  GitHub's web interface, which commits as the account's primary address and
  never sees a local config. That is a standing trap, not a one-off slip, and it
  is now written down as one.

**Also.** The demo video is recorded, and it is **6:13 against a 5:00
maximum**. The cue sheet targeted 4:50, so the overrun is 1:23 and it is spread
across all twelve slides rather than concentrated in one — the signature of
reading slides aloud instead of talking over them. The existing cut list is
worth about 1:05, so it does not close the gap on its own; `docs/05` now says
what else has to go and what must survive whatever happens, which is the demo,
the code walk-through and the AI disclosure. An earlier attempt to measure the
file reported a corrupt `mvhd` atom with `timescale=0`; the atom was fine and
the parse offset was wrong.

Migrating the API to Vercel was investigated to kill the ~50s cold start and
**rejected**: four separate pieces of process-level state make it impossible —
the batch job queue in a `Map`, the SSE progress stream, the USCCB grace cookie,
and the calendar cache. Each serverless invocation gets a fresh process, and the
10–15 minute batch runtime exceeds the function limit regardless. The cold start
has four fixes that are not a migration, and none is chosen yet.

**Checked, and left as it is.** The week-of-09-22 report ended "Next. ... Then
the REST pass", and the REST pass never happened. Looked at properly this week:
`server/src/routes/` is 904 lines over eight routers, resource-oriented, with
`GET`/`POST`/`PUT`/`DELETE` doing what their names say and nested resources
where there are nested resources (`/api/settings/schedule/:date`,
`/api/readings/:date/override`). Six endpoints are action-shaped rather than
resource-shaped — `POST /api/readings/check`, `/api/calendar/expand`,
`/api/potf/parse`, `/api/potf/:id/duplicate`, `/api/generate/preview` and
`/api/batch/:id/cancel`.

The week-2 report called those "remote procedure calls wearing HTTP", and on
reflection that was the wrong thing to be embarrassed about. "Check these
eighteen dates and tell me which ones are missing a psalm response" is not a
resource; nor is "cancel this job". Forcing them into `PUT /api/checks/{id}`
would invent a resource that nothing stores in order to satisfy a shape. The
genuine defect the same paragraph named — `routes/settings.js` building a
`WHERE` clause by string concatenation — **is** fixed, and that was the row
worth acting on. So: no REST pass, and the reason is written down rather than
the promise being quietly dropped.

**Open.** The Supabase Site URL still points at `localhost:3000`. `--color-gold-edge` still fails
contrast as a graphic, and the reason it has not been a one-line fix is now
written down: the token is doing two jobs and needs splitting. The prayer-book
importer is still unrun against a real book. `docs/assets/phone.png` predates
both the entry spread and the bottom tab bar, so it shows a layout that no
longer exists. The video needs re-recording. 152 tests (138 server — 137 pass, 1
skipped — and 14 client).

---

## Week of 2026-09-29

**Done.** Accounts. LiturgyGen serves more than one parish now: sign-in is a
screen inside the app built on Supabase Auth, `organizations` and `memberships`
joined the schema, and every table a parish owns carries an `org_id` that every
query names. `readings_cache` deliberately does not — the readings for a date
are the same everywhere, so one office's fetch warms the cache for all of them.
Row Level Security is the second lock, ten policies in one Supabase migration.

The signed-out screens were rebuilt as one spread, an ink cover leaf and a paper
leaf, and the app got a mark of its own — an open missal with a gold ribbon —
replacing the chapel's seal, which belongs to one parish and not to the
software. The landing page at `/` is the same spread rendered without React.

A prayer-book importer went in: upload PDFs or photographs of a General
Intercessions book, and the pages are read and offered as drafts for approval.
It is **written and not yet run against a real book**, and it is marked that way
everywhere it is mentioned.

**What broke, and what it cost.** Three regressions came in with the accounts
work and all three were invisible — no failing test, nothing in a log:

- `GET /api/settings` threw `ReferenceError: req is not defined` on every call,
  because the handler's parameter was still `_req`. In production that becomes
  "LiturgyGen's server is not running", which told me to start a server that was
  already running. It shipped twice.
- Progress used `new EventSource`, which cannot send an `Authorization` header.
  Behind the new gate it answered 401 before a single frame, which killed both
  the progress bar and the USCCB countdown — and a 401 on an EventSource is an
  error event with no status on it, so nothing said why.
- `npm run seed` called the seeder with no parish, hit an early return, and
  printed "0 inserted" as though it had worked. Then it turned out nothing in
  the project had ever loaded `.env`, so the command could not run at all.

Both of the first two now have tests written specifically because they left no
trace: `server/test/boot.test.js` drives the four requests the client fires on
sign-in over real HTTP, and `client/test/stream.test.js` asserts the client
never reaches for `EventSource`. I checked each by putting the bug back.

**Also.** The office's 362 transcribed prayers reached the host — not by
committing the books, which the licence forbids, but by loading one parish and
cloning it inside the database. Confirmed: all three parishes hold 362 real
prayers across seven seasons, where before they held 19 placeholders each and
nothing else.

**Open.** The Supabase Site URL still points at `localhost:3000`, so a fresh
sign-up's confirmation link goes nowhere — two dashboard fields. One advisory
left standing and written up rather than quietly fixed. The importer is still
untested. 152 tests pass (138 server, 14 client).

---

## Week of 2026-09-22

**Done.** The application is feature-complete and runs end to end on a laptop
and on an office machine: calendar, day book with live missalette preview,
readings with the USCCB scraper and the Evangelizo fallback, the Prayers of the
Faithful cascade, batch generation, the Word builder, and the Windows installer.
92 tests pass (82 server, 10 client).

This week the class template was merged in and the repository restructured
around it: `server/server.js` as the entry point, `server/db/` with the
PostgreSQL pool, schema and seed, `/healthz` and `/readyz`, CORS with named
origins, `.env.example` in three places, the GitHub Pages workflow, and
`client/src/api/` split into one interface with two implementations so the Pages
build has something to show before the API is deployed. Screenshots of every
screen are in `docs/assets/`.

**Stuck.** Nothing is blocking, but two things are named rather than solved. The
database is still SQLite: `docs/07-postgres-migration-map.md` lists all twenty
call sites and what each becomes, and none of them are converted yet. And the
API is not RESTful — `/api/readings/check`, `/api/calendar/expand`,
`/api/potf/parse` and `/api/batch/:id/cancel` are remote procedure calls wearing
HTTP, and `routes/settings.js:43` builds a `WHERE` clause by string
concatenation. Validated input today, but it is the wrong shape.

**Hours.** About 14. Roughly 5 on the restructure, 4 on the demo-mode split and
its seed generator, 2 on screenshots and docs, 3 reading the migration surface.

**Next.** The PostgreSQL migration, in the order the map sets out: settings
first, then the readings overrides, then the schedule, then the POTF service,
with the cascade last. Then the REST pass.

---

## Week of 2026-09-15

**Done.** Planning, and the bulk of the build. Proposal, wireframes at two
widths, and the design system, all generated from the real token values rather
than drawn separately and left to drift. The monorepo, Vite with an API proxy,
and CI on Node 20.10 and 22.

**Stuck.** USCCB's HTML is not consistent: days with optional readings put the
"or" block inside the section above it rather than beside it, so the first
parser produced a reading made of two different books stuck together. Captured
the edge-case pages as fixtures. Also spent longer than expected deciding how to
handle the General Intercessions volumes, which are published and copyrighted —
landed on keeping the transcriptions in a git-ignored folder and shipping
placeholder prayers in the public build.

**Hours.** About 20.

**Next.** Finish the services, the client, and the desktop packaging.
