# Weekly reports

Newest at the top. Never edit an old one.

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
