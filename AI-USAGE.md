# AI usage

LiturgyGen was built with AI assistance. This file is the record of it, kept as
the work happened rather than written up at the end.

**Assistant:** Claude (Anthropic), used through Claude Code in the terminal and
through the Antigravity IDE for the earlier server work.

**Roughly how much it touched:** most of the first draft of the services layer,
the `.docx` builder and the React components. It did not touch the liturgical
rules, the parser heuristics, the Prayers of the Faithful cascade, or the
PostgreSQL migration — those are listed under *Who wrote what* below.

Commit links point at `https://github.com/Damudachi/LiturgyGen`.

---

## 1. How I used AI

### 2026-09-13 — Windows desktop packaging

- **Tool:** Claude (Claude Code)
- **What I asked for:** a way to ship the app to an office PC with no Node.js,
  no browser tab and no administrator rights.
- **What it gave back:** a C# launcher using WebView2 (the web view already in
  Windows 10 and 11), an Inno Setup script for a per-user install, and a build
  script that bundles a Node runtime, the server and the built client.
- **What I kept, what I changed, and why:** kept the WebView2 approach — it was
  the right call and I would not have found it myself. Changed the process
  lifecycle: its first version left the Node process running after the window
  closed, so the port stayed held and the next launch failed. I added the
  parent-PID watchdog in `server.js` that exits when the launcher goes away.
- **Commit:** `c34f132` — https://github.com/Damudachi/LiturgyGen/commit/c34f132

### 2026-09-13 — Splash screen and window lifecycle

- **Tool:** Claude (Claude Code)
- **What I asked for:** something on screen while the bundled server boots,
  because the window was blank for three or four seconds.
- **What it gave back:** a splash window in the launcher, shown until the server
  answers its health check, then handed off to the main window.
- **What I kept, what I changed, and why:** kept it. I changed the seal image to
  be clipped to a circle, and fixed a bug where minimising the window made it
  restore itself about two seconds later.
- **Commit:** `06c40ae` — https://github.com/Damudachi/LiturgyGen/commit/06c40ae

### 2026-09-14 — Shadow and depth system

- **Tool:** Claude (Claude Code)
- **What I asked for:** the calendar looked flat; I wanted depth without
  changing the layout, the colours or the type.
- **What it gave back:** three shadow tokens (`rest`, `raise`, `float`) tinted
  with the palette's navy rather than grey, and a `.lift` class pairing the
  raise shadow with a small upward translate.
- **What I kept, what I changed, and why:** kept all of it, strengthened the
  values because the first pass was too subtle to see, and added the
  `prefers-reduced-motion` branch that drops the translate.
- **Commit:** `6ade5fe` — https://github.com/Damudachi/LiturgyGen/commit/6ade5fe

### 2026-09-14 — Dual installer builds

- **Tool:** Claude (Claude Code)
- **What I asked for:** one installer for the public that contains no
  copyrighted prayers, and one for the office that does.
- **What it gave back:** a `--public` flag on `desktop/build.mjs` that skips
  `server/data/orillo` and writes to a different output folder, plus the
  `.gitignore` rules that let the public one be committed and keep the office
  one out.
- **What I kept, what I changed, and why:** kept it. This is the piece that made
  the repository publishable at all.
- **Commit:** `c34f132` — https://github.com/Damudachi/LiturgyGen/commit/c34f132

### 2026-09-20 — Planning documents

- **Tool:** Claude (Claude Code)
- **What I asked for:** wireframes and a design system document generated from
  the code that already existed, rather than drawn by hand and left to drift.
- **What it gave back:** Python scripts that render the screen map, the
  wireframes at two widths, the component tree and the design system sheets as
  images, reading the real token values out of `client/src/index.css`.
- **What I kept, what I changed, and why:** kept the approach. It found a real
  bug while doing it: `--color-gold-edge` at 2.42:1 against the page fails the
  contrast requirement for a meaningful icon.
- **Commit:** `cfba87c` — https://github.com/Damudachi/LiturgyGen/commit/cfba87c

### 2026-09-27 — Merging the class template

- **Tool:** Claude (Claude Code)
- **What I asked for:** fold the class template's required shape into this
  repository without breaking the 92 tests or the desktop build: `server.js` at
  the server root, `db/` with a pool and a schema, the `src/api/` demo-mode
  split, `/healthz` and `/readyz`, the Pages workflow, `.env.example` files.
- **What it gave back:** all of it, plus `server/tools/build-demo-seed.mjs`,
  which generates the demo data for GitHub Pages from the real services.
- **What I kept, what I changed, and why:** kept it. The one thing I insisted on
  was that the demo seed strip the scripture text and the office's prayers
  before writing a file that goes into a public repository — see case 3 below.
- **Commit:** `d6baf70` — https://github.com/Damudachi/LiturgyGen/commit/d6baf70

### 2026-09-27 — Security pass before going public

- **Tool:** Claude (Claude Code)
- **What I asked for:** audit the repository against the security announcement —
  secrets in history, workflow leaks, personal data, open write routes — and
  scaffold a Basic Auth gate **without writing the credential check**, because
  the brief says to write that myself.
- **What it gave back:** the audit (clean history, no workflow secrets, but 19
  unauthenticated write routes and my email on all 18 commits), the middleware
  wiring with `/healthz` and `/readyz` deliberately outside the gate, nine tests
  describing the contract, and a rewrite of the one SQL `WHERE` clause that was
  still built by string concatenation.
- **What I kept, what I changed, and why:** kept the wiring and the tests. The
  detail I would not have thought of is that the stub has to **fail closed** —
  an unimplemented check throws, and the middleware catches it and returns 401
  rather than calling `next()`. A gate that falls open when it breaks is worse
  than no gate, because you think you have one.
- **Commit:** `9182b6d` — https://github.com/Damudachi/LiturgyGen/commit/9182b6d
  (the audit's own write-up landed alongside it in `468c5a7`)

### 2026-10-04 — The credential check, and the Render deployment

- **Tool:** Claude (Claude Code)
- **What I asked for:** write `checkCredentials` — the one function the security
  pass deliberately left for me — and tell me what deploying to Render actually
  requires.
- **What it gave back:** the implementation (scheme match, base64 shape check,
  split on the first colon only, sha256 + `timingSafeEqual`), with the eleven
  tests in `server/test/basicAuth.test.js` green and the whole server suite at
  121 passing on that day. Both have since moved: Supabase Auth replaced the
  Basic Auth gate later the same week, so that middleware now sits at
  `server/src/middleware/retired/basicAuth.js` and its test file is parked as
  `server/test/retired-basicAuth.test.js.txt` — kept, but no longer run. The
  suite is 138 server tests and 14 client tests today. It also found that
  Render's free web services have an **ephemeral
  filesystem**, which matters because the readings cache is JSON files on disk:
  every spin-down would throw away readings that cost a three-minute cooldown
  each to fetch.
- **What I kept, what I changed, and why:** kept it. The part I would not have
  got right on my own is why hashing before `timingSafeEqual` is necessary at
  all — not to hide the password but to make both buffers 32 bytes, because
  `timingSafeEqual` throws on unequal lengths and the length is itself a leak.
- **Also in this session:** it pointed out that the PostgreSQL migration had
  stopped one table short. The readings - the only data in the app that is
  expensive to get - were still one JSON file per day under
  `server/.cache/readings`, and a free host's filesystem is ephemeral, so every
  spin-down would have thrown them away and made the office re-pay the USCCB
  cooldown. I had believed the migration already fixed the waiting; it had not,
  and I would not have found that out until the demo. `readings_cache` and the
  three `scraperService` functions that now read it are AI-written too, with
  eleven tests in `server/test/readingsCache.test.js`. Recorded as finding 6 in
  `docs/07-postgres-migration-map.md`.
- **What this costs me:** `checkCredentials` was supposed to be mine, and
  section 3 now says it is not.
- **Commit:** `99649e9` — https://github.com/Damudachi/LiturgyGen/commit/99649e9
  (the credential check) and `00b5e65` —
  https://github.com/Damudachi/LiturgyGen/commit/00b5e65 (`readings_cache` and
  the three `scraperService` functions that read it)

### 2026-10-04 — The signed-out screens, a dedicated mark, and three auth regressions

- **Tool:** Claude (Claude Code)
- **What I asked for:** the landing page and the sign-in screen looked bland and
  too narrow on a laptop. Then, as they came up: the prayers from my local folder
  were not in the new accounts, the progress bar and the USCCB countdown had
  stopped moving, the email confirmation link errored, and I wanted a dedicated
  logo instead of the chapel's seal.
- **What it gave back:**
  - `client/src/components/auth/EntryLayout.jsx`, the signed-out spread, and the
    same layout rewritten into `server/src/views/pages.js` for the page at `/`.
  - `client/src/components/Logo.jsx` and `client/public/favicon.svg`.
  - **Three bugs the accounts work had left behind**, all found by reading rather
    than by a failing test: `routes/settings.js` took `_req` and then called
    `req.orgId`, so `GET /api/settings` threw `ReferenceError: req is not
    defined` on every call and the client reported "LiturgyGen's server is not
    running"; progress used `new EventSource`, which takes no options and so
    cannot send an `Authorization` header, meaning the stream 401'd and both the
    progress bar and the server's own one-second USCCB countdown went dead; and
    `npm run seed` called `seedPotfTemplates()` with no `orgId`, hit the
    early-return guard and printed "0 inserted" as though it had worked.
  - `/auth-forward.js`, because Supabase sends email links to the Site **origin**
    and the app lives at `/app` — a fragment is never sent to the server, so a
    valid confirmation link was dropping people on a page that could not read it.
  - `server/test/boot.test.js` and `client/test/stream.test.js`, which cover the
    two regressions that were invisible.
  - The prayer-book importer: `server/src/services/importService.js`,
    `routes/potfImport.js`, `client/src/components/prayers/ImportBook.jsx`.
- **What I kept, what I changed, and why:** kept nearly all of it. Two things I
  pushed back on. It first built the ribbon in the seam as **six** ribbons, one
  per liturgical colour; it read as a striped comb and the white one vanished
  against the paper, so it is one gold ribbon now — the same thing `Book.jsx`
  already uses. And it had restyled the sign-in screen while telling me there was
  no landing page in the repository, having searched only `client/`; the real one
  is server-rendered in `views/pages.js`, which is why my first two redeploys
  changed nothing.
- **What this costs me:** a fair amount. The entry screens, the mark and the
  importer are AI-written, and section 3 says so. The importer is also
  **untested** — written to be reviewed, not yet run against a real book.
- **Commits:** `b989f40` — https://github.com/Damudachi/LiturgyGen/commit/b989f40 (the signed-out entry spread);
  `c6bc7ab` — https://github.com/Damudachi/LiturgyGen/commit/c6bc7ab (the mark, the favicon and `/auth-forward.js`);
  `ffcbf93` — https://github.com/Damudachi/LiturgyGen/commit/ffcbf93 (the `req`/`_req` boot regression and `boot.test.js`);
  `8a5a2f4` — https://github.com/Damudachi/LiturgyGen/commit/8a5a2f4 (the importer, the authenticated stream and
  `stream.test.js`); `7adcbfe` — https://github.com/Damudachi/LiturgyGen/commit/7adcbfe (OCR and the multi-file import flow)

---

## 2. Where the AI got it wrong

### Case 1 — It rebuilt the whole visual system, and it was worse

- **What it gave me:** I asked for the design to look less generic. It replaced
  the fonts, the palette and the type hierarchy in one pass — a whole new
  identity, delivered confidently.
- **What was wrong with it:** it looked worse than what it replaced. The
  cream/navy/gold palette came from the chapel seal and meant something; the
  replacement was a generic Ordo-inspired theme that meant nothing. The AI had
  no way to know that, because the reason was outside the code.
- **What I did instead:** reverted the entire commit. Then I asked for depth and
  shadow only, keeping the layout, colours and type exactly as they were, which
  is what the screens actually needed and took an hour instead of an evening.
- **Commit:** reverted in `8f979f1`, replaced by `6ade5fe` —
  https://github.com/Damudachi/LiturgyGen/commit/6ade5fe

### Case 2 — It suggested solving the USCCB bot challenge

- **What it gave me:** when I said USCCB was blocking the scraper, one of the
  options offered was to drive a real browser at the page so the proof-of-work
  challenge would be solved by the browser itself. It would have worked.
- **What was wrong with it:** the challenge is an access control that USCCB put
  there deliberately. Defeating it is not a technical problem to be solved, it
  is a decision about someone else's site, and the AI presented it as a
  straightforward option among others.
- **What I did instead:** did not do it. The app keeps the grace cookie it is
  given, spends it fast (eight to eleven dates in ten to fifteen seconds), then
  leaves the site completely alone for three minutes. Everything it fetches is
  cached permanently, it falls back to Evangelizo, and there is a paste box for
  the date nothing else reaches.
- **Commit:** `11d94f1` — https://github.com/Damudachi/LiturgyGen/commit/11d94f1

### Case 3 — It would have committed copyrighted text to a public repository

- **What it gave me:** the first version of the demo-mode seed generator
  serialised whatever `buildDay()` returned straight into
  `client/src/api/seed.json`, which is committed.
- **What was wrong with it:** that output contains the full New American Bible
  reading text, copyright USCCB and the Confraternity of Christian Doctrine, and
  on this machine it would also have pulled in the office's transcriptions of
  two published ST PAULS volumes. Both would have been redistributed in a public
  repository, permanently, with my name on it.
- **What I did instead:** the generator now replaces every body of text with one
  stand-in line and ships citations only, and the templates in the seed are the
  placeholder prayers written for this tool rather than anything from the books.
  `grep` for a distinctive phrase from the readings is part of the check.
- **Commit:** `server/tools/build-demo-seed.mjs`, added in `d6baf70` — https://github.com/Damudachi/LiturgyGen/commit/d6baf70

### Case 4 — It assumed the parser could be written from the page structure

- **What it gave me:** a first USCCB parser that read each heading and the block
  under it as one reading.
- **What was wrong with it:** days with optional readings do not work that way.
  On 8 September the First Reading is a choice between Micah and Romans, and the
  Gospel has a long and a short form; the "or" blocks belong to the section
  above them rather than standing on their own. The parser silently produced a
  first reading made of two different books stuck together.
- **What I did instead:** saved the real HTML from the edge-case dates as test
  fixtures (`server/test/fixtures/usccb-2026-09-08-optional.html`) and rewrote
  the block-walking logic against them. This is why the parser tests exist.
- **Commit:** `9e59339` — https://github.com/Damudachi/LiturgyGen/commit/9e59339

### Case 5 — It restyled the wrong page, and told me there wasn't one

I asked it to improve the landing page and the log-in. It searched `client/` for
the landing page, found only the React sign-in screen, and told me plainly that
there was no landing page in the codebase — then asked me a question built on
that, and restyled the sign-in screen.

The landing page is real. It is server-rendered at `/` by
`server/src/views/pages.js`, with the React app mounted at `/app`. So I pushed
and redeployed twice and saw nothing change, because the page I was looking at
was the one file it had not looked in.

**What I take from it:** the confident negative is the dangerous output. "There
is no X in this codebase" is a claim about everything it did *not* read, and it
had read one directory. When it told me later that `GET /api/settings` had been
throwing on every call since the accounts commit, I checked that one against the
database before believing it — and it was right, all 19 prayers in both parishes
were placeholders. The lesson is not to distrust it; it is that an absence is a
much weaker finding than a presence, and I should ask which files it actually
opened.

**Commit:** the spread finally reached the real landing page in `c6bc7ab` — https://github.com/Damudachi/LiturgyGen/commit/c6bc7ab, after two redeploys that changed only `client/`.

### Case 6 — It hid its own error message behind a 500

The prayer-book importer refused an image upload with "Something went wrong on
the server." I sent it looking for a crash. There wasn't one.

The code was raising a deliberately helpful error — "this looks like a scan,
which needs optical character recognition, install it with..." — and giving it
HTTP status **501**. The error handler hides the message of any 5xx in
production, because a stack trace or a driver error describes your file layout
to a stranger. 501 is a 5xx. So the one sentence that explained the problem was
the exact sentence being suppressed, by a rule it had written itself a week
earlier.

**What I take from it:** it got both halves right and the interaction between
them wrong. That is the shape of most of its mistakes — not a wrong line, but
two correct lines that have never met. The fix was to let an error opt in to
being shown (`error.expose`) and to use it only where the message was composed
for the reader.

**Commit:** `7adcbfe` — https://github.com/Damudachi/LiturgyGen/commit/7adcbfe.

### Case 7 — It gave me commands it had never run

It told me to run `npm run seed -- --org <uuid>` to get the office's prayers
onto the host. I ran it and got "DATABASE_URL is not set", while looking at a
filled-in `.env`.

Nothing in this project had ever loaded `.env`. Not the seed script, not
`npm run dev`, not `npm run db:schema` — the project relied on Render putting
variables in the environment, and `db/run.js`'s own header says to pass
`--env-file=.env` by hand. The command it handed me could not work on any
machine, and it had written that command, in a README section, twice.

**What I take from it:** it will write instructions with the same confidence it
writes code, and the instructions are the part nothing checks. Code at least
has to import. From then on I asked it to run anything it told me to run.

**Commit:** `cb90955` — https://github.com/Damudachi/LiturgyGen/commit/cb90955 — the commit that made `.env` load at all.

### Case 8 — It shipped the importer twice without running it

I said it was fine not to test the prayer-book importer yet, and it took that
further than I meant. Two separate faults were sitting in it:

- `tesseract.js` v7 exposes `recognize` on its default export only, so reading
  it off the module namespace gave `undefined`.
- Passing a third options argument — one whose single key was `undefined` —
  killed the OCR worker from inside a `MessagePort`, which escapes a
  `try/catch` and takes the whole process down instead of rejecting.

Both surfaced in the first thirty seconds of actually running it on a PNG.

**What I take from it:** "not tested" and "probably works" are not the same
claim, and it does not reliably distinguish them. When it says a path is
untested, that is a statement about its confidence, not about the odds.

**Commit:** `7adcbfe` — https://github.com/Damudachi/LiturgyGen/commit/7adcbfe — both faults were fixed in the commit that
added OCR, because running it was what found them.

### Case 9 — It estimated its own output instead of measuring it

It wrote the presentation script with a word budget per slide and a stated
total of four minutes fifty. Then it measured what it had actually written:
**six minutes twelve**. Half the beats were over their own budgets, and three of
the headings claimed word counts that did not match the words underneath them.

It only caught this because I had asked for the timings in the first place; it
would otherwise have handed me a script that overran a five-minute cap, and I
would have found out mid-take.

**What I take from it:** the arithmetic it does about its own work is a guess
wearing a number. It is good at writing the script and good at counting the
words, and it will not do the second one unless told to.

**Commit:** none in this repository — `docs/08-presentation-script.md` is
git-ignored, because it says my name in its first line. It is in the private
coursework folder with the rest of the identifying material.

### Case 10 — It ignored a note the codebase had already written for it

Asked to improve the sign-in screen, it put six ribbons in the seam, one per
liturgical colour. Two things were wrong: at seven pixels they read as a striped
comb rather than bookmarks, and the **white** one was invisible against the cream
half of the page.

That second fault is the interesting one. `client/src/index.css` has a comment
directly above the liturgical colours that says, in so many words, that white is
an ivory stripe and needs an edge so it shows — written months earlier for the
calendar, for exactly this reason. The file was open. It had read it well enough
to copy the palette out of it.

**What I take from it:** it reads a file for what it is looking for, not for what
the file is telling it. The comments that exist to stop somebody repeating a
mistake are the ones it is most likely to skim, which is an argument for the
comments being there and not an argument against them.

**Commit:** `b989f40` — https://github.com/Damudachi/LiturgyGen/commit/b989f40 — the entry spread as it landed, with one gold
ribbon rather than six.

---

## 3. Who wrote what

### Written by me

- **File:** `server/src/services/philippineOrdo.js`
- **Commit:** `60cbd17` — https://github.com/Damudachi/LiturgyGen/commit/60cbd17
- **What it does and why it is built this way:** romcal ships a Philippine
  particular calendar, but it is missing local celebrations that the printed
  Philippine ORDO carries, and it ranks a few of them differently. This file is
  the overlay that fixes that. It holds the local feasts romcal does not have,
  and a `precedenceRank()` function that decides which celebration wins when two
  land on the same date — the liturgical table of precedence, in code, where a
  Solemnity beats a Feast beats a Memorial beats a ferial day. I wrote it
  because the rules come out of the ORDO, not out of anything a model has read,
  and because getting them wrong means the wrong readings are printed for a
  school Mass. `nthWeekdayOfMonth()` is in here too, for the feasts fixed to a
  weekday rather than a date.

- **File:** `server/src/services/potfService.js` — the `resolveForDay` cascade
- **Commit:** `28b679d` — https://github.com/Damudachi/LiturgyGen/commit/28b679d
- **What it does and why it is built this way:** picks which Prayers of the
  Faithful page belongs to a date. It runs seven tiers, most specific first:
  celebration id, then the calendar date (MM-DD, because the book keys 17–24
  December and 2–5 January to dates rather than to liturgical weeks), then
  season + week + weekday, then narrower combinations, then the Ordinary Time
  book for the same week and weekday. It stops at the first hit. The order is
  the order the office uses when they flip through the two physical volumes, and
  I worked it out by watching them do it. The fallback to Ordinary Time is the
  part a naive matcher gets wrong: a day in a proper season with no page of its
  own does not get *nothing*, it gets the Ordinary Time page for that weekday.

- **File:** `server/src/lib/orilloParser.js`
- **Commit:** `9f8f3c8` — https://github.com/Damudachi/LiturgyGen/commit/9f8f3c8
- **What it does and why it is built this way:** turns a page typed or scanned
  out of the General Intercessions books into a structured template. The printed
  page has no markup — it is a heading, a paragraph of invitation, a response in
  capitals, numbered intentions, and a concluding prayer, separated by nothing
  but layout. The parser works on those conventions: capitals mean a response,
  a leading numeral means an intention, the last paragraph is the conclusion. It
  also repairs the OCR mistakes that kept recurring in the scans. This is the
  file I rewrote most often, because every new section of the book broke an
  assumption in it.

- **File:** `server/src/middleware/retired/basicAuth.js` — the `checkCredentials`
  function. **Not mine. Written by Claude on 4 October 2026** and disclosed in
  section 1 under that date. I had planned to write it myself; I ran out of week
  and asked for it instead. The surrounding middleware, the wiring in `app.js`
  and the eleven tests that covered it were also scaffolded with assistance.
  **This gate is retired.** Supabase Auth replaced it later the same week —
  a single shared password cannot name a parish — so the file sits under
  `retired/` and its tests are parked as
  `server/test/retired-basicAuth.test.js.txt`. It is left in the repository, and
  described here, because the disclosure stands whether or not the code is still
  wired in: `server/src/middleware/requireAuth.js` is what guards `/api` today.
- **What it does and why it is built this way:** decides whether an
  `Authorization: Basic <base64>` header carries the configured username and
  password. Four things in it are not obvious until you read RFC 7617: the
  username cannot contain a colon but the **password can**, so it has to split
  on the first colon only rather than on every colon; the scheme token is
  case-insensitive, so `basic` has to be accepted as well as `Basic`; a
  malformed or missing header has to be a rejection rather than a crash; and
  the comparison has to be constant-time via `crypto.timingSafeEqual`, because
  `===` on a string returns the moment two bytes differ and that timing
  difference leaks how much of the password is right. Hashing both sides first
  is the usual way round `timingSafeEqual` throwing on buffers of unequal
  length, which would otherwise leak the password's length.

- **The PostgreSQL migration is NOT mine.** This bullet used to say it would be
  "mine end to end" and that "every one of the twenty query rewrites is my
  own". I wrote that as a plan, in advance, and then it is not how the week
  went: I ran out of time and Claude did the migration - the schema, the twenty
  query rewrites, the async conversion through every call site, the
  `readings_cache` table, and the tests. `docs/07-postgres-migration-map.md`
  records the work; section 1 of this file records who did it. Leaving the
  original sentence in would have been the one dishonest line in this
  document, so it is replaced rather than quietly deleted.


- **File:** `server/src/routes/` — the whole HTTP surface
- **Commit:** `7e30ee4` onward — https://github.com/Damudachi/LiturgyGen/commit/7e30ee4
- **What it does and why it is built this way:** the REST API: `calendar`,
  `readings`, `generate`, `batch`, `potf`, `settings` and `account`. About nine
  hundred lines, and until now filed in this document under the AI, which was a
  filing mistake rather than a decision: the AI did not write them.
  Two things in here are worth naming. The first is
  what each route refuses: a malformed date is a 400 with a message written for
  the office rather than a 500 with a driver error in it, because the person
  reading it is a parish secretary and not me. The second is which routes are
  **streams** rather than requests — a batch over two hundred days cannot answer
  in one response, so `POST /api/batch` returns a job and
  `/api/batch/:id/events` reports on it as it goes, cancellable half way. That
  shape is the reason the panel can say "making day 4 of 22" at all.

- **Files:** `server/src/services/calendarService.js` and `server/src/lib/dates.js`
- **Commit:** `7e30ee4` onward — https://github.com/Damudachi/LiturgyGen/commit/7e30ee4
- **What they do and why they are built this way:** turning a date into a
  liturgical day, and the month grid the calendar screen draws. These sit
  directly on top of `philippineOrdo.js`, which is also mine: romcal answers
  "what does the general calendar say", the ORDO overlay corrects it, and this is
  the layer that asks both in the right order and hands one answer to the rest of
  the app.
  `lib/dates.js` is small and deliberately boring, and it is where the timezone
  handling finally settled. Every date in this application is a calendar day in
  the Philippines, never a moment in time, and these functions are the only
  place allowed to know that.

### Written by the AI, named here

- **Files:** `client/src/components/auth/EntryLayout.jsx`,
  `client/src/components/Logo.jsx`, `client/public/favicon.svg`, the spread in
  `server/src/views/pages.js`, `server/src/services/importService.js`,
  `server/src/routes/potfImport.js`,
  `client/src/components/prayers/ImportBook.jsx`, `server/test/boot.test.js`,
  `client/test/stream.test.js`, and the `/auth-forward.js` route.
- **Commits:** `b989f40` — https://github.com/Damudachi/LiturgyGen/commit/b989f40, `c6bc7ab` — https://github.com/Damudachi/LiturgyGen/commit/c6bc7ab,
  `ffcbf93` — https://github.com/Damudachi/LiturgyGen/commit/ffcbf93, `8a5a2f4` — https://github.com/Damudachi/LiturgyGen/commit/8a5a2f4 and
  `7adcbfe` — https://github.com/Damudachi/LiturgyGen/commit/7adcbfe
- **What they do and what I decided:** the signed-out spread and the app's own
  mark, which replaced the chapel's seal because that seal belongs to one parish
  and the app now serves more than one; the prayer-book importer; and the two
  tests that cover the regressions nothing else caught. My decisions inside
  them: one gold ribbon rather than six liturgical ones, and — the one I would
  defend hardest — the importer does **not** guess a page's season, week or
  weekday. It reads a title and stops. A page number is not liturgical data, and
  the whole argument of `philippineOrdo.js` is that this application does not
  invent that mapping. So every imported draft arrives unticked and needs a day
  set by hand before it can be saved. That makes importing a hundred pages
  slower, on purpose.


### Mine, but not a file in this repository

- **Not in this repository:** the Supabase project
- **Evidence:** migration `20261004110845_multi_parish_schema_with_rls`; ten
  policies across seven tables, listable with `select * from pg_policies`
- **What I did and why it is not a file here:** I set up and configured Supabase
  — the project, the Auth settings, the Row Level Security migration, and the
  environment wiring on Render. None of it is a line of code in this repository
  and all of it is load-bearing, so it is named here rather than left out
  because it does not show up in a diff.
  The part worth defending is the RLS policies. The scoping the application
  relies on is in the services, which name `org_id` on every query; these
  policies are the second lock, for anything that reaches the database without
  going through the app at all. They hang off one function, `user_org_ids()`,
  which is `SECURITY DEFINER` for a specific reason: a policy on `memberships`
  that reads `memberships` to decide who you are recurses into itself. That
  function is also the one standing Supabase advisory, written up in
  `Docu/project/SECURITY-CHECKLIST.md` rather than quietly fixed.
  `readings_cache` is the one table whose policy is read-only and not scoped to a
  parish, which is the same deliberate exception the schema makes.

### The AI-written part I understand best

- **File:** `server/src/services/docxService.js`
- **Commit:** `44a3298` — https://github.com/Damudachi/LiturgyGen/commit/44a3298
- **What it does and why we kept it:** builds the Word file. I had not used the
  `docx` library before and this would have taken me a week on my own; the first
  draft of the paragraph builders came from the AI. I understand it because I
  spent a day fixing it against the office's sample document, and the fixing is
  where the learning was.

  The office's missalette is not "a Word document with the readings in it". It
  is a specific geometry: Letter paper, margins of 1.0625 / 0.8125 / 0.5625 / 1
  inches, Book Antiqua, and a right-aligned tab stop at 9630 twips so the
  scripture citation sits flush with the right margin on the same line as the
  heading. A twip is a twentieth of a point, which is the unit Word actually
  stores positions in, and that single number is why the citations line up.
  Settings feed in as style overrides: whether each reading starts a new page,
  whether the first psalm response is printed in capitals, whether "Let us pray
  to the Lord." is appended to each intention. The structure I kept; the numbers
  I measured myself out of the sample.
