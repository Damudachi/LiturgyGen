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
- **Commit:** (this week's commit)

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
- **Commit:** (this week's commit)

### 2026-10-04 — The credential check, and the Render deployment

- **Tool:** Claude (Claude Code)
- **What I asked for:** write `checkCredentials` — the one function the security
  pass deliberately left for me — and tell me what deploying to Render actually
  requires.
- **What it gave back:** the implementation (scheme match, base64 shape check,
  split on the first colon only, sha256 + `timingSafeEqual`), with the eleven
  tests in `server/test/basicAuth.test.js` green and the whole server suite at
  121 passing. It also found that Render's free web services have an **ephemeral
  filesystem**, which matters because the readings cache is JSON files on disk:
  every spin-down would throw away readings that cost a three-minute cooldown
  each to fetch.
- **What I kept, what I changed, and why:** kept it. The part I would not have
  got right on my own is why hashing before `timingSafeEqual` is necessary at
  all — not to hide the password but to make both buffers 32 bytes, because
  `timingSafeEqual` throws on unequal lengths and the length is itself a leak.
- **What this costs me:** this function was supposed to be mine, and section 3
  now says it is not.
- **Commit:** (this week's commit)

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
- **Commit:** `server/tools/build-demo-seed.mjs` — (this week's commit)

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

- **File:** `server/src/middleware/basicAuth.js` — the `checkCredentials`
  function. **Not mine. Written by Claude on 4 October 2026** and disclosed in
  section 1 under that date. I had planned to write it myself; I ran out of week
  and asked for it instead. The surrounding middleware, the wiring in `app.js`
  and the eleven tests in `server/test/basicAuth.test.js` were also scaffolded
  with assistance.
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

- **Coming next week:** the PostgreSQL migration and the REST work, which are
  mine end to end. `docs/07-postgres-migration-map.md` is the plan; the
  scaffolding (`server/db/pool.js`, `schema.sql`, `seed.sql`) was set up with
  assistance, and every one of the twenty query rewrites is my own.

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
