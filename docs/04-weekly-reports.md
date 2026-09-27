# Weekly reports

Newest at the top. Never edit an old one.

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
