# LiturgyGen

Mass readings missalette and Prayers of the Faithful generator for the Campus Ministry
Office. Pick a day on the calendar (or several at once), and LiturgyGen works out the
liturgical day, fetches that day's readings, attaches the right Prayers of the Faithful,
and hands back a `.docx` laid out exactly like the office's printed missalette.

---

## Try it on Windows

**[Download LiturgyGen-Setup-1.0.0.exe](https://github.com/Damudachi/LiturgyGen/raw/main/desktop/release/LiturgyGen-Setup-1.0.0.exe)**
(about 32 MB, from [`desktop/release/`](desktop/release/)).

LiturgyGen runs as an ordinary Windows program in a window of its own — no browser tabs,
no Node.js, no command line, no administrator needed. It needs 64-bit Windows 10 or 11.

1. Run the installer. Windows may say *"Windows protected your PC"* because the installer
   is not signed: choose **More info → Run anyway**.
2. Open **LiturgyGen** from the desktop icon. It opens in its own window.
3. To close it, close the window. If days are still being made, it asks first.

This download is the **public build**: the program only. It does not include the office's
transcriptions of the General Intercessions books, which are under copyright (see
[below](#3-the-intercession-books-have-to-be-entered-by-hand)). So a new install starts
empty:

- **Readings** work straight away. They are fetched from USCCB the first time you open a
  day, so the computer needs internet access.
- **Prayers of the Faithful** come only from a small set of placeholder prayers written
  for this tool. They are left off the page by default. To see them on the missalette,
  turn on *Use a placeholder prayer when neither book has one* in **Settings**, or add
  your own prayers on the **Prayers** screen with **Type in**.

Each computer keeps its own prayers, corrections and saved readings in
`%LOCALAPPDATA%\LiturgyGen`, and updating or uninstalling never touches them. To remove
LiturgyGen, use **Settings → Apps** in Windows. The full guide, including backups and
where the log is, is in [`desktop/README.md`](desktop/README.md).

### For the office

The office computers use the **office build** instead. It is the same program plus a
starting copy of the office's prayers and saved readings. It is never committed and is
passed around by USB drive or shared folder only (see
[Building the installers](#building-the-installers)).

## Using it

**Calendar.** The month as tiles, each with its liturgical colour and what the day keeps.

- **Click a day** to open it as a book: the day and its steps on the left, the missalette
  exactly as it will print on the right. From there you can edit the page, choose other
  prayers, fetch the readings again, paste the USCCB page by hand, and download the Word
  file.
- **Select several days** turns clicks into ticks, with shortcuts for the month's
  weekdays, Mon/Wed/Fri, First Friday and your saved Mass schedule. Days that need a
  look — a missing psalm response, no Gospel Acclamation, no Prayers of the Faithful —
  are marked on the calendar and listed first in the side panel with what is wrong, so
  you can fix them before making anything. Days whose readings were never fetched can be
  fetched from the panel without making files. **Make Word files** then produces a ZIP of
  one file per day, or one master document.

**Prayers.** The Prayers of the Faithful templates: search, edit, and **Type in** a page
straight from the General Intercessions books.

**Settings.** Font and page layout, which optional parts print, school-wide intentions,
and whether a placeholder prayer is used when neither book has one (off by default).

---

## Development

### Requirements

- Node.js 20.10 or newer
- Windows, macOS or Linux (developed on Windows 11); building the installers needs Windows
- An internet connection when fetching readings for a date that is not already saved

### Setup

```bash
npm install     # installs the root, server and client workspaces
npm run seed    # creates the SQLite database and loads the POTF templates
```

#### The office's transcriptions are not in this repository

The prayers transcribed from the office's General Intercessions volumes are
copyrighted, so they are kept out of version control. They live in

```
server/data/orillo/*.json     # gitignored, one file per section of the book
```

A checkout without them still runs: `npm run seed` loads the placeholder set and says
which sections it could not find. To get the real prayers onto a machine, copy the
office's `server/data/orillo` directory into place and re-run `npm run seed`, or type the
pages in on the Prayers screen (see [The intercession books have to be entered by
hand](#3-the-intercession-books-have-to-be-entered-by-hand)).

Please keep it that way. Do not commit the transcriptions, the scanned PDFs or
the ORDO - see `LICENSE` for what this project does and does not cover.

### Running

```bash
npm run dev     # server on :4000, Vite dev server on :5173 with /api proxied
```

Open <http://localhost:5173>.

For a single-process production run:

```bash
npm run build   # builds the client into client/dist
npm start       # Express serves the API and the built client on :4000
```

Open <http://localhost:4000>.

### Tests

```bash
npm run test:server
npm run test:client
```

**Server — 82 tests** covering the date helpers, the citation/lectionary tables, the
USCCB and Evangelizo parsers (against captured fixtures, including a day with optional
readings), the cache-reuse and bot-check-cooldown rules, the offline day check, the
liturgical-title rules, the Philippine ORDO overlay and POTF template resolution, and the
generated `.docx` — its section order, tab-stop alignment, psalm-response casing,
intention numbering and page geometry, read straight out of the generated file.

**Client — 10 tests** covering the pure logic behind the calendar: selecting days,
the shortcuts, tile labels and keyboard movement, and which chosen days need a look.

Two server tests assert against the office's own transcriptions and are skipped
automatically when `server/data/orillo/` is absent, so a clean checkout and CI both run
green. CI runs both suites plus the client build on Node 20.10 and 22
(`.github/workflows/ci.yml`).

### Building the installers

On Windows, with [Inno Setup 6](https://jrsoftware.org/isinfo.php) installed
(`winget install JRSoftware.InnoSetup`). The first build also downloads the pinned
WebView2 SDK from NuGet into `desktop/.cache`. There are two builds:

| Command | Writes | Includes the office's books and data | Committed |
| --- | --- | --- | --- |
| `npm run package:desktop:public` | `desktop/release/LiturgyGen-Setup-<version>.exe` | No | **Yes**: this is the download linked above |
| `npm run package:desktop` | `desktop/dist/LiturgyGen-Setup-<version>.exe` | Yes | Never (`dist/` is gitignored) |

Both are about 32 MB. Both bundle:

- the Node that ran the build, so the database driver always matches it;
- the server with its dependencies pinned to the exact versions installed here;
- the built client;
- `LiturgyGen.exe`, a small launcher compiled with the C# compiler that ships with
  Windows. It shows a small splash while it starts the server hidden on `127.0.0.1` only
  and loads the page out of sight, then shows the app in its own
  window through [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) —
  the web view built into Windows — so there is no browser tab to lose. The navbar is the
  window's title bar (`client/src/components/WindowControls.jsx`): the page reports drags
  and button presses over WebView2's message channel and the launcher moves, sizes and
  closes the window, so snapping and drag-to-restore behave as in any Windows app. In a
  normal browser tab none of this appears. Opening it twice
  brings the window forward; closing the window stops the server. Without WebView2 it
  falls back to the browser and an icon beside the clock.

The office build also bundles **a starting copy of this machine's data**: the database and
saved readings, plus the `server/data/orillo` books. A computer installing for the first
time starts from it; one that already has LiturgyGen keeps its own. Because that copy
holds the copyrighted transcriptions, **never commit the office build or upload it
anywhere public.** The public build leaves all of it out, and a new install creates its own
database with the placeholder prayers.

Raise `version` in the root `package.json` before building an update. The installer
is per-user (`%LOCALAPPDATA%\Programs\LiturgyGen`) and never needs an administrator.
When you publish a new public build, delete the old `.exe` from `desktop/release/` and
update the download link at the top of this file.

---

## How a page is built

```
date ──► calendarService ──► liturgical day (season, week, weekday, rank, cycles)
                │
                ├──► scraperService ──► readings   (override ► cache ► USCCB ► Evangelizo)
                │
                └──► potfService    ──► prayers    (template cascade, then Ordinary Time)
                          │
                          ▼
                  compositionService ──► docxService ──► .docx
```

### `services/calendarService.js`

Wraps [`romcal`](https://github.com/romcal/romcal) with the **Philippines** particular
calendar. Produces the printed heading in house style — `FIRST WEEK OF ADVENT -
WEDNESDAY` for Advent/Lent/Easter (spelled-out ordinal), `34th WEEK IN ORDINARY TIME -
WEDNESDAY` for Ordinary Time (numeric ordinal), and the celebration's own name for feasts
and memorials. It also returns the lookup key the POTF cascade uses.

### `services/scraperService.js` and `services/providers/`

Readings are resolved through a chain, first hit wins:

1. **Manual override** stored in SQLite for that date (anything you save in the editor or
   paste from USCCB).
2. **Saved readings** from an earlier fetch — the raw pages in `server/.cache/usccb/` and
   the parsed readings in `server/.cache/readings/`.
3. **USCCB** — `https://bible.usccb.org/bible/readings/MMDDYY.cfm`, the authoritative
   source and the one the office's own documents follow.
4. **Evangelizo** — a public feed used only as a partial fallback (see the caveats below).

Readings for a date never change, so anything fetched is kept permanently: once a day
has been fetched, opening or making it again sends no request at all, across restarts.
The one exception is a partial copy from the fallback, which is re-fetched from USCCB the
next time it is needed.

When the lectionary offers a choice, USCCB prints each further option as its own block
headed only `or` — 8 September, the Nativity of the BVM, offers a choice of First Reading
(Micah or Romans) and a long and short form of the Gospel. Those blocks belong to the
section above them. **The first option is always the one used**, as the office prints it;
the rest are recorded in `alternatives` against the right section for the editor. An
option only ever displaces the first if the first arrived with no text at all.

Parsed readings are stamped with `PARSER_VERSION`. Bumping it when a parser changes
invalidates every stale entry, so a fix reaches dates that were already fetched — and
because the raw page is still on disk, re-parsing costs nothing and sends no new request.

All outbound requests go through a single serialised queue (`lib/httpQueue.js`) that
enforces a minimum spacing between hits — 800 ms by default, tunable with
`USCCB_DELAY_MS`. This is deliberate and should not be lowered: batch runs of twenty-plus
dates are exactly the pattern that gets an IP blocked.

### `services/potfService.js`

Templates are matched from most to least specific, so a hand-written prayer for one exact
day always beats the generic one:

```
celebration id  ►  calendar date (MM-DD)  ►  season + week + weekday
                ►  season + week          ►  season + weekday
```

tried in the day's own season, then its ferial season (a memorial falls back to the
weekday it sits on). When the occasion has no prayer of its own, the office prays the
**Ordinary Time** prayer for the nearest matching week and weekday, and its heading is
printed above the intercessions so the page names the day the prayer was written for.
Only after that come the whole-season catch-alls.

Placeholder prayers written for this tool are skipped unless *Use a placeholder prayer*
is on in Settings: by default a day neither book covers prints without Prayers of the
Faithful and says so, rather than printing a prayer the office never chose. Re-running
`npm run seed` refreshes only the rows you have never edited; anything you have touched on
the Prayers screen is left alone.

### `services/compositionService.js`

Assembles the day and lists everything that stands between it and a finished page. The
same composition runs **offline** for `POST /api/readings/check`, which reports for each
date what is missing from what is already on hand, without asking any source — that is
what lets *Select several days* mark a whole month's problem days in a moment.

### `services/docxService.js`

Reproduces the sample document's measurements rather than approximating them: Letter page,
margins of 1.0625″/0.8125″/0.5625″/1″, Book Antiqua, a right tab stop at 9630 twips so the
citation sits flush right without typed spaces, the psalm as one paragraph of soft breaks,
the first response in capitals and later ones in sentence case. Page geometry, font and
the optional bits (Gospel, sequence, refrain repetition) come from Settings.

### `services/batchService.js`

Runs a set of dates sequentially with per-date error isolation — one date failing never
stops the run — and streams progress over Server-Sent Events (*"Processing date 4 of 22:
October 6, 2026…"*). If USCCB serves its bot check mid-run, the run waits out the
cooldown (up to 15 minutes in total) instead of spending the remaining dates on the
fallback, then makes a second pass over any day that still came out thin.

Exports either a ZIP of one file per date, or a single combined document with page breaks
between days. A ZIP always includes `NOT-GENERATED.txt` listing anything that failed and
why. A run started with `checkOnly` fetches the readings without building documents —
the side panel's *Get readings* button.

---

## Things to know before relying on it

### 1. USCCB actively blocks scrapers

The USCCB site sits behind a proof-of-work bot challenge. When it triggers, the site
returns a "Checking connection" page instead of readings, and LiturgyGen surfaces that as
a `USCCB_CHALLENGE` error rather than retrying — retrying is what deepens the block, and
solving the challenge would mean circumventing an access control the site owner put there
on purpose. **LiturgyGen does not attempt to bypass it.**

You only meet it for dates that have never been fetched: saved readings are served
without contacting USCCB at all.

Two ordinary client manners keep a batch out of the challenge for as long as possible,
neither of which touches the proof-of-work:

- **Cookies are kept.** USCCB issues a short-lived grace cookie with a page it agrees to
  serve, and returning it is what lets the next date through. Before the jar existed,
  every request after the first looked like a brand-new unverified visitor, so a batch was
  challenged from its second date onward however slowly it ran — which is why so many days
  used to come out of the Evangelizo fallback without their psalm response and Gospel
  Acclamation.
- **A challenge opens a cooldown.** The block is a state, not a per-request verdict, and
  asking again renews it. For `USCCB_COOLDOWN_MS` after a challenge, USCCB is left
  completely alone: saved pages still serve, everything else falls back immediately.
  The first date after the cooldown lapses probes USCCB again, and a success re-opens the
  tap for the rest of the run.

Left alone, the block usually lifts within a few minutes. When you hit it, you have three
ways forward:

- **Wait** and run the same days again; already-fetched dates are not re-hit. A day that
  came from the fallback is *not* treated as settled — it is re-fetched on the next run,
  so running the same days twice is the normal way to close the gaps.
- **Paste the page by hand** — in the day's book choose *Paste from USCCB*, open the
  linked USCCB page in your browser, and paste its page source (right-click → View page
  source). It parses identically.
- **Let the Evangelizo fallback fill in**, with the gaps below.

### 2. The Evangelizo fallback is partial, by design

Evangelizo carries the reading texts but **not** the psalm response or the Gospel
Acclamation, and it only serves roughly ±30 days around today. When a page is built from
it, LiturgyGen marks the day as needing a look and lists exactly what is missing, so
those two lines can be typed in before printing. It is a safety net for a blocked
weekday — not a substitute for USCCB.

### 3. The intercession books have to be entered by hand

None of the office's General Intercessions volumes are bundled: they are published books
that ST PAULS still sells, and shipping a digital copy inside the app would be
redistributing them. The office's own transcriptions are loaded from
`server/data/orillo/`, which is outside version control - see
[Setup](#the-offices-transcriptions-are-not-in-this-repository).

Entering a day takes about a minute. On the **Prayers** screen press **Type in**, then
type the page as it is printed:

```
SECOND OF FEBRUARY              <- optional heading

The invitation the priest reads.

LORD, HEAR OUR PRAYER.          <- the response, in capitals
Or                              <- optional
FATHER, KEEP OUR LAMPS BURNING.

1. That ... Let us pray to the Lord.
...
5. That ... Let us pray to the Lord.

The concluding prayer. Amen.
```

**Check it** shows how the page was split before anything is saved, and flags whatever it
could not find. Page numbers are ignored, the `Or` connector is dropped, an intention
wrapped across two printed lines is rejoined, and the two phrases the document supplies
itself — `Let us pray to the Lord.` on each intention and the closing `Amen.` — are
stripped so they never print twice.

Then say when it should be used: season, week, day, or a **calendar date** as `MM-DD` for
the stretches the book fixes to a date rather than to a weekday (early January, for
instance). Typed-in prayers are saved as `custom`, so re-running the seeder never
overwrites them.

### A note on the font

The office's sample has the reading bodies in Roboto while everything else is Book
Antiqua, which looks like a paste artefact rather than a house rule. LiturgyGen uses Book
Antiqua throughout. If the office wants the sample reproduced literally, change the font
in Settings.

---

## Layout

```
LiturgyGen/
├── server/
│   ├── src/
│   │   ├── config.js              port, data folder, cache and calendar settings
│   │   ├── index.js               Express app; serves client/dist in production
│   │   ├── db/                    migrations, settings, POTF seeds
│   │   ├── lib/                   dates, Bible book tables, request queue, readings shape
│   │   ├── routes/                calendar, readings, generate, batch, potf, settings
│   │   └── services/              calendar, scraper + providers, potf, composition, docx, batch
│   ├── test/                      tests and captured HTML fixtures
│   ├── data/                      SQLite database and the office's books (gitignored)
│   └── .cache/                    saved USCCB pages and parsed readings (gitignored)
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── calendar/          month grid, day tiles, selection, the making panel
│   │   │   ├── day/               a day's book: its page, editor, prayer picker, preview
│   │   │   ├── prayers/           template list, form, Type in
│   │   │   ├── Book.jsx           the open-book layout
│   │   │   ├── SettingsPanel.jsx
│   │   │   └── ui.jsx             buttons, fields, alerts
│   │   └── lib/                   dates, selection, tiles, issues - pure, tested
│   └── test/
├── desktop/                       installers: launcher, Inno Setup script, build
│   └── release/                   the public installer (committed)
└── docs/                          design notes
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API/server port |
| `HOST` | all interfaces | Address to listen on; the installed app uses `127.0.0.1` |
| `LITURGYGEN_DATA_DIR` | unset | Folder for the database and saved readings; unset uses `server/data` and `server/.cache` |
| `DB_FILE` | `<data>/liturgygen.sqlite` | SQLite location, overriding the data folder |
| `USCCB_DELAY_MS` | `800` | Minimum spacing between outbound requests |
| `USCCB_TIMEOUT_MS` | `20000` | Per-request timeout |
| `USCCB_COOLDOWN_MS` | `180000` | How long USCCB is left alone after it serves its bot check |
| `USCCB_CACHE` | `true` | Set `false` to stop saving and reusing fetched readings |
| `ROMCAL_CALENDAR` | `philippines` | Particular calendar |

## Output names

- Single date — `READINGS-December-04-2024-Wednesday.docx`
- Several days, ZIP — `Mass-Readings-December-2024.zip`
- Several days, one master file — `Mass-Readings-December-2024.docx`
