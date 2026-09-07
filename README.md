# LiturgyGen

Mass readings missalette and Prayers of the Faithful generator for the Campus Ministry
Office. Pick a date (or a whole month), and LiturgyGen works out the liturgical day,
fetches that day's readings, attaches the right Prayers of the Faithful, and hands back a
`.docx` laid out exactly like the office's printed missalette.

---

## Requirements

- Node.js 20.10 or newer
- Windows, macOS or Linux (developed on Windows 11)
- An internet connection when fetching readings for a date that is not already cached

## Setup

```bash
npm install     # installs the root, server and client workspaces
npm run seed    # creates the SQLite database and loads the POTF templates
```

### The office's transcriptions are not in this repository

The prayers transcribed from the office's General Intercessions volumes are
copyrighted, so they are kept out of version control. They live in

```
server/data/orillo/*.json     # gitignored, one file per section of the book
```

A checkout without them still runs: `npm run seed` loads the placeholder set,
says which sections it could not find, and every date still resolves to
something printable. To get the real prayers onto a machine, copy the office's
`server/data/orillo` directory into place and re-run `npm run seed`, or type the
pages in through the Templates tab (see [The intercession books have to be
entered by hand](#3-the-intercession-books-have-to-be-entered-by-hand)).

Please keep it that way. Do not commit the transcriptions, the scanned PDFs or
the ORDO - see `LICENSE` for what this project does and does not cover.

## Running

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

## Tests

```bash
npm run test:server
```

74 tests covering the date helpers, the citation/lectionary tables, the USCCB and
Evangelizo parsers (against captured fixtures, including a day with optional readings),
the cache-reuse and bot-check-cooldown rules, the liturgical-title rules, the Philippine
ORDO overlay and POTF template resolution, and the generated `.docx` — its section order,
tab-stop alignment, psalm-response casing, intention numbering and page geometry, read
straight out of the generated file.

Two of them assert against the office's own transcriptions and are skipped automatically
when `server/data/orillo/` is absent, so a clean checkout and CI both run green. CI runs
this suite plus the client build on Node 20.10 and 22 (`.github/workflows/ci.yml`).

---

## How a page is built

```
date ──► calendarService ──► liturgical day (season, week, weekday, rank, cycles)
                │
                ├──► scraperService ──► readings   (override ► cache ► USCCB ► Evangelizo)
                │
                └──► potfService    ──► prayers    (5-level template cascade)
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

1. **Manual override** stored in SQLite for that date (anything you edit in the UI).
2. **Disk cache** of previously fetched pages (`server/.cache/usccb/`).
3. **USCCB** — `https://bible.usccb.org/bible/readings/MMDDYY.cfm`, the authoritative
   source and the one the office's own documents follow.
4. **Evangelizo** — a public feed used only as a partial fallback (see the caveats below).

When the lectionary offers a choice, USCCB prints each further option as its own block
headed only `or` — 8 September, the Nativity of the BVM, offers a choice of First Reading
(Micah or Romans) and a long and short form of the Gospel. Those blocks belong to the
section above them. **The first option is always the one used**, as the office prints it;
the rest are recorded in `alternatives` against the right section for the editor. An
option only ever displaces the first if the first arrived with no text at all.

Parsed readings are cached alongside the raw pages and stamped with
`PARSER_VERSION`. Bumping it when a parser changes invalidates every stale entry, so
a fix reaches dates that were already fetched — and because the raw page is still on
disk, re-parsing costs nothing and sends no new request.

All outbound requests go through a single serialised queue (`lib/httpQueue.js`) that
enforces a minimum spacing between hits — 800 ms by default, tunable with
`USCCB_DELAY_MS`. This is deliberate and should not be lowered: batch runs of twenty-plus
dates are exactly the pattern that gets an IP blocked.

### `services/potfService.js`

Templates are matched from most to least specific, so a hand-written prayer for one exact
day always beats the generic one:

```
celebration id  ►  season + week + weekday  ►  season + week
                ►  season + weekday         ►  season  ►  ferial fallback
```

Seeded with the office's own Advent and Ordinary Time sets, plus fallbacks for Christmas,
Lent, the Triduum, Easter and feasts. Re-running `npm run seed` refreshes only the rows
you have never edited; anything you have touched in the Templates tab is left alone.

### `services/docxService.js`

Reproduces the sample document's measurements rather than approximating them: Letter page,
margins of 1.0625″/0.8125″/0.5625″/1″, Book Antiqua, a right tab stop at 9630 twips so the
citation sits flush right without typed spaces, the psalm as one paragraph of soft breaks,
the first response in capitals and later ones in sentence case. Page geometry, font and
the optional bits (Gospel, sequence, refrain repetition) come from Settings.

### `services/batchService.js`

Runs a month sequentially with per-date error isolation — one date failing never stops the
run — and streams progress over Server-Sent Events (*"Processing date 4 of 22: October 6,
2026…"*). Exports either a ZIP of one file per date, or a single combined document with
page breaks between days. A ZIP always includes `NOT-GENERATED.txt` listing anything that
failed and why.

---

## Two things to know before relying on it

### 1. USCCB actively blocks scrapers

The USCCB site sits behind a proof-of-work bot challenge. When it triggers, the site
returns a "Checking connection" page instead of readings, and LiturgyGen surfaces that as
a `USCCB_CHALLENGE` error rather than retrying — retrying is what deepens the block, and
solving the challenge would mean circumventing an access control the site owner put there
on purpose. **LiturgyGen does not attempt to bypass it.**

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
  completely alone: cached pages still serve, everything else falls back immediately.
  The first date after the cooldown lapses probes USCCB again, and a success re-opens the
  tap for the rest of the run.

In practice the challenge is triggered by bursts and lapses on its own within the hour.
When you hit it, you have three ways forward:

- **Wait** and re-run the batch; already-fetched dates come from cache and are not re-hit.
  A day that came from the fallback is *not* treated as settled — it is re-fetched on the
  next run, so running the same batch twice is the normal way to close the gaps.
- **Import the page by hand** — open the USCCB page in your browser, save or copy the
  HTML, and paste it into *Import HTML* on the Single Date tab. It parses identically.
- **Let the Evangelizo fallback fill in**, with the gaps below.

### 2. The Evangelizo fallback is partial, by design

Evangelizo carries the reading texts but **not** the psalm response or the Gospel
Acclamation, and it only serves roughly ±30 days around today. When a page is built from
it, LiturgyGen marks the document and warns in the UI listing exactly what is missing, so
those two lines can be typed in before printing. It is a safety net for a blocked
weekday — not a substitute for USCCB.

### 3. The intercession books have to be entered by hand

LiturgyGen ships with a small set of placeholder Prayers of the Faithful so every date
resolves to something printable. None of the office's General Intercessions volumes are
bundled: they are published books that ST PAULS still sells, and shipping a digital copy
inside the app would be redistributing them.

The office's own transcriptions are loaded from `server/data/orillo/`, which is outside
version control - see [Setup](#the-offices-transcriptions-are-not-in-this-repository).

Entering a day takes about a minute. On the **Templates** tab press **Type in**, then type
the page as it is printed:

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
│   │   ├── config.js              port, cache and calendar settings
│   │   ├── index.js               Express app; serves client/dist in production
│   │   ├── db/                    migrations, settings, POTF seeds
│   │   ├── lib/                   dates, Bible book tables, request queue, readings shape
│   │   ├── routes/                calendar, readings, generate, batch, potf, settings
│   │   └── services/              calendar, scraper + providers, potf, composition, docx, batch
│   ├── test/                      tests and captured HTML fixtures
│   ├── data/                      SQLite database (gitignored)
│   └── .cache/                    fetched USCCB pages (gitignored)
└── client/
    └── src/components/            SingleDateTab, BatchTab, TemplatesTab, SettingsPanel,
                                   LiturgicalCalendar, DocumentPreview
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API/server port |
| `DB_FILE` | `server/data/liturgygen.sqlite` | SQLite location |
| `USCCB_DELAY_MS` | `800` | Minimum spacing between outbound requests |
| `USCCB_TIMEOUT_MS` | `20000` | Per-request timeout |
| `USCCB_COOLDOWN_MS` | `180000` | How long USCCB is left alone after it serves its bot check |
| `USCCB_CACHE` | `true` | Set `false` to disable the raw-HTML cache |
| `ROMCAL_CALENDAR` | `philippines` | Particular calendar |

## Output names

- Single date — `READINGS-December-04-2024-Wednesday.docx`
- Batch ZIP — `Mass-Readings-December-2024.zip`
- Batch combined — `Mass-Readings-December-2024.docx`
