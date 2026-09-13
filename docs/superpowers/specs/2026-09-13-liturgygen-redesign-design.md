# LiturgyGen redesign: the Calendar that opens into a book

Date: 2026-09-13
Status: approved in brainstorming, awaiting written-spec review

## Goal

Give LiturgyGen the identity of the Chapel of the Holy Guardian Angel (Holy Angel
University) and make the office's work quicker to do: see the month, open a day,
check it, download it; or tick several days and make them all. Every existing
feature stays. The server and the Word documents do not change.

## Decisions made

| Question | Decision |
|---|---|
| Scope | New look and smoother flow; nothing removed |
| Identity | The chapel seal: navy, gold, silver-blue |
| Layout | One Calendar screen. Clicking a day opens a book over the month; "Select several days" turns clicks into ticks for making many files |
| Palette | B, "Vellum": paper background, stone (silver-blue warmed toward the paper) calendar days, paper book pages |
| Type | Newsreader for headings, Source Sans 3 for everything else, Book Antiqua on the printed page |
| Seal | A web-sized copy is committed to the client |
| Design skills | `frontend-design` (Anthropic) for direction and copy; `ui-ux-pro-max` for colour harmony, type scale and accessibility rules |

## 1. Navigation

A navy header holds the seal (36px), "LiturgyGen" and three tabs:
**Calendar · Prayers · Settings**. The active tab is gold. "One day" and "Many days"
are gone as tabs; both live in Calendar. The app opens on Calendar showing the
current month.

## 2. Calendar screen

### 2.1 The month (browsing)

- Month bar: month and year (Newsreader 32px), previous and next month buttons,
  **Today**, and on the right the **Select several days** button.
- **Select several days** is the most prominent control on the screen: gold fill,
  navy text, 18px extra-bold, 12px radius, raised edge and soft gold glow, with an
  empty checkbox glyph. It is never hidden or collapsed.
- A 7-column grid, Sunday first, one tile per day, filling the available height.
  Each tile shows:
  - a 5px liturgical-colour stripe along the top (green, violet, red, rose, gold;
    liturgical white is an ivory stripe with a thin gold-grey edge so it shows on
    stone);
  - the date number, 18px semibold;
  - what is kept, 13px, at most two lines, cut with an ellipsis. Solemnities,
    feasts, memorials and Sundays show the celebration's name; an ordinary weekday
    shows "Weekday". The full occasion title is in the tile's accessible label and
    tooltip.
- Sundays use the deeper stone tile. Today's tile shows a small "Today" beside the
  number. The day whose book is open, or was last open, has a navy outline and a
  pale gold fill.
- Clicking a tile opens the book for that day (section 3).

### 2.2 Selecting several days

Pressing **Select several days**:

- turns the button navy with a gold ticked box and the label
  **Done selecting** plus a gold count badge ("Done selecting 22");
- shows a row of shortcut buttons under the month bar: **Weekdays**,
  **Mon, Wed, Fri**, **First Friday**, **Scheduled Masses**, **Clear**. The first
  three add the matching days of the month on screen, using the server's existing
  date expansion. Scheduled Masses adds the saved schedule. Clear removes every
  tick;
- makes a tile click tick or untick the day instead of opening the book. A ticked
  tile has a navy outline, a navy-tinted fill and a navy check mark in its corner;
- keeps ticks when moving between months;
- slides in the **making panel** on the right (29% of the width, paper background).

Pressing **Done selecting** leaves selection mode; the ticks and the panel stay
until cleared, so the office can check a day in the book and come back.

### 2.3 The making panel

Top to bottom:

1. "22 days chosen" (Newsreader 20px).
2. The chosen days in date order ("Tue 1 Sept · Weekday"). Each row can be removed
   or opened in the book. The list scrolls; it is not truncated.
3. **School-wide intentions**: a count and a change link opening a text area. Same
   behaviour as today: prefilled from Settings, one per line, for this batch.
4. **Save these dates as our Mass schedule**.
5. **Make 22 Word files**: the panel's primary button, navy, full width.

While files are being made the panel shows "Making day 8 of 22…", a progress bar,
a **Cancel** button and a result line per finished day (done, needs a look, or
could not be made, with the reason). When finished:

- **Download all as ZIP** and **Download one master file**;
- days that could not be made, or need a look, are listed first. Clicking one
  opens its book so the readings can be pasted or the prayers chosen, then it can
  be made again.

## 3. The book (one day)

Clicking a day dims the month (navy at 38%) and opens a two-page book over it. The
book is paper (`--page`) with a fine edge, a soft gutter shadow down the middle and
a gold ribbon hanging from the top of the left page. **Close book** (top right),
Escape, or clicking the dimmed month closes it and returns focus to the day's tile.

### 3.1 Left page: the day

- The date (14px), the celebration (Newsreader 28px), and colour, rank and week
  (14px, with a colour dot).
- Three steps with round markers: **1 Day chosen** (done, navy), **2 Check the
  readings and prayers** (current, gold), **3 Download the Word file**. The step
  markers are a real sequence, so numbering is appropriate.
- Under step 2, three links: **Edit this page**, **Use other prayers**,
  **Get readings again**. When the readings source is blocked a fourth appears,
  **Paste from USCCB**, with the existing instructions and text area.
- Notes: the server's warnings, each as a gold-edged note. When the prayers come
  from a fallback the note says where from, for example "The prayers come from the
  Ordinary Time book (24th week, Wednesday), so that heading is printed above
  them."
- **Download Word file**: navy pill button, 17px bold, with the file name below it.

### 3.2 Right page: the missalette

The existing document preview, set in Book Antiqua 15px on the paper page. It
scrolls inside the page. It always reflects unsaved edits, so it matches the
download exactly.

### 3.3 Editing

**Edit this page** turns the left page into the edit form (heading above the
intercessions, readings, psalm, acclamation, priest's invitation, responses,
intentions, conclusion) while the right page updates as you type. The form scrolls
within the left page and ends with **Save corrections**, **Undo saved corrections**
and **Back to the day**. Closing the book with unsaved changes asks "Discard your
changes to this day?".

**Use other prayers** opens a searchable list of templates on the left page, with
"Choose for me" first. Placeholders are labelled "(placeholder)".

### 3.4 Motion

Opening the book is the app's one piece of motion: 240ms, scaling up and fading in
from the clicked tile. Closing takes 160ms. With reduced motion on, the book simply
appears. Selection ticks and the panel sliding in use 150ms transitions.

## 4. Prayers screen

The template manager with the same features: search, filter by season, new
template, type in a prayer from the book, duplicate, delete, save.

- Left: the template list on stone, grouped by season, each row showing title,
  week or day, and a "placeholder" tag where relevant.
- Choosing a template or **New template** opens a book on the right side of the
  screen (not over the list): left page is the form (title, season, week, day,
  celebration, calendar date, invitation, responses, intentions, conclusion,
  notes); right page is the prayer as it will print.
- **Type in a prayer from the book** uses the same book: left page holds the typed
  text and where it belongs; right page shows what LiturgyGen understood.

## 5. Settings screen

The same settings, on paper sections with Newsreader headings: document defaults,
Prayers of the Faithful (including the placeholder switch), standing school-wide
intentions, cached readings. Checkboxes and fields use the shared controls.

## 6. Visual system

### 6.1 Colour tokens (Palette B, "Vellum")

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1B2740` | Header, main text |
| `--navy` | `#263551` | Buttons, outlines, ticks, links |
| `--gold` | `#F2BC1B` | Select several days, current step, active tab, ribbon, note edges. Fill only; never text on paper |
| `--gold-edge` | `#C99500` | Raised edge under gold buttons |
| `--bg` | `#F4EFE3` | App background |
| `--page` | `#F7F2E6` | Book pages, panels |
| `--page-hi` | `#FCFAF4` | Inputs, raised paper |
| `--edge` | `#DCD3BE` | Paper borders |
| `--tile` | `#E7E8DF` | Calendar days, secondary buttons |
| `--tile-edge` | `#CFD1C5` | Tile borders |
| `--tile-sun` | `#DADCD1` | Sundays |
| `--muted` | `#4F5669` | Secondary text (5.3:1 on Sundays, the darkest surface; 7.0:1 on inputs) |
| `--note` | `#FBEFC4` | Note background (text `#3F3300`) |
| Liturgical | green `#2E7D4F`, violet `#6D28D9`, red `#B3261E`, rose `#DB7093`, gold `#CA8A04`, white `#FFFDF6` with `#C9B98E` edge | Tile stripes and dots |
| Status | success `#2E7D4F`, error `#B3261E` | Always paired with an icon and words |

Replaces the stone and amber Tailwind colours used today. Tokens are defined once in
`index.css` under Tailwind's `@theme`.

### 6.2 Type

- Newsreader (500, 600, 700) and Source Sans 3 (400, 500, 600, 700, 800), bundled
  with the app through Fontsource packages so it works without internet.
- Book Antiqua (system font) for the printed page, falling back to Palatino
  Linotype, Palatino, Georgia.
- Scale in px: 32 month · 28 day title · 20 panel titles and app name · 18 big
  button and tile dates · 17 download · 16 body, tabs, steps, inputs · 15 printed
  page · 14 labels, notes, links · 13 tile names and weekday row. Nothing smaller
  than 13px, and 13px only for short text.
- Line height 1.5 for body text, 1.15 for headings. Weights: headings 600–700,
  labels 500, body 400, primary buttons 700–800.

### 6.3 Shape, spacing, elevation

- Spacing on a 4px grid.
- Radius: tiles 8px, buttons 10–12px, pill buttons full, book 10px.
- Three shadows only: tile none, panel low, book high (the book must read as lifted
  off the month).

### 6.4 Accessibility and responsiveness

- Visible focus ring (3px navy with a paper gap) on every control.
- Month grid keyboard use: arrow keys move between days, Enter opens the book or
  ticks the day, Escape closes the book or leaves selection mode.
- The book is a dialog: focus moves into it and stays there until it closes.
- Colour is never the only signal: ticks have check marks, liturgical colours are
  named in labels, warnings have words.
- Targets at least 40px high.
- Designed for office desktops (1280px and wider). Down to 1024px the making panel
  narrows. Below 900px the book's pages stack (the day, then the missalette) and
  the panel moves under the month.

## 7. Code organisation

Client only (`client/src`). Existing API calls in `api.js` are reused unchanged.

```
App.jsx                       header + Calendar · Prayers · Settings
index.css                     tokens, fonts, base styles
assets/seal-128.png, seal-256.png

components/ui.jsx             restyled shared controls (Button, Field, Input,
                              Textarea, Select, Checkbox, Badge, Alert, Spinner,
                              EmptyState) plus Note and PillButton
components/Book.jsx           the book shell: pages, gutter, ribbon, close. Two
                              presentations: "overlay" (dim layer, dialog focus
                              trap, Escape, opening motion; used by Calendar) and
                              "inline" (sits in the layout, no dim or trap; used
                              by Prayers). Knows nothing about liturgy.

components/calendar/
  CalendarScreen.jsx          month cursor, browse or select mode, open day
  MonthGrid.jsx               tiles and keyboard navigation (replaces
                              LiturgicalCalendar.jsx)
  DayTile.jsx                 one tile
  SelectSeveralButton.jsx     the big button in both states
  SelectionShortcuts.jsx      Weekdays, Mon Wed Fri, First Friday, Scheduled, Clear
  MakingPanel.jsx             chosen days, intentions, schedule, make, progress,
                              results, downloads
  useBatchJob.js              start, server-sent progress, cancel, downloads
                              (moved out of BatchTab.jsx)

components/day/
  DayBook.jsx                 loads the day, holds edits, chooses the left page
  DayPage.jsx                 summary, steps, links, notes, download
  EditPage.jsx                the edit form (moved out of SingleDateTab.jsx)
  PrayerPicker.jsx            "Use other prayers"
  PasteReadings.jsx           "Paste from USCCB"
  DocumentPreview.jsx         restyled; logic unchanged

components/prayers/
  PrayersScreen.jsx, TemplateList.jsx, TemplateForm.jsx, TypeInPrayer.jsx
  (split from TemplatesTab.jsx)

components/SettingsPanel.jsx  restyled

lib/dates.js                  unchanged
lib/selection.js              pure: toggle, add many, remove, sort, group by
                              month, count; no React
lib/tiles.js                  pure: tile label for a day, liturgical colour key,
                              accessible label
```

Deleted after the move: `SingleDateTab.jsx`, `BatchTab.jsx`, `TemplatesTab.jsx`,
`LiturgicalCalendar.jsx`.

Each screen component owns its state; `Book.jsx`, `MonthGrid.jsx` and
`MakingPanel.jsx` receive data and callbacks and hold no server state, so they can
be understood on their own.

### Dependencies

- Add `@fontsource/newsreader` and `@fontsource/source-sans-3`.
- No other new runtime dependencies. Icons stay on `lucide-react`.

### Server

No server changes are part of this redesign. The POTF heading fix (`potfTitle`)
made earlier on 2026-09-13 is already in place and is what the book's note and
preview use.

## 8. Error handling

- Month fails to load: the grid area shows "Could not load September 2026" with the
  server's reason and a **Try again** button; the month bar still works.
- Day fails to load in the book: the left page explains what happened. If the
  readings source blocked the request it shows the **Paste from USCCB** steps.
  Download is disabled until readings exist.
- Neither book has prayers: the note from the server, plus a **Use other prayers**
  button.
- Making files: per-day failures stay in the panel list with their reason; a
  failed start shows an error note in the panel with the server's message.
- Downloads: success and failure messages appear as a short note in the place the
  download was started (book or panel), not in a page-wide banner.

## 9. Testing and verification

- **Unit tests for the new pure modules** (`lib/selection.js`, `lib/tiles.js`),
  run with `node --test` from a new `client/test` folder, added as
  `npm run test:client` and to CI next to `test:server`.
- **Server tests** stay as they are (80 today) and must keep passing.
- **Build**: `npm run build` must pass (already in CI).
- **In-app check before calling it done**, with the real server running:
  1. Opening the app shows the current month with colours and names.
  2. Clicking a weekday opens the book, the preview matches the downloaded Word
     file, Escape closes it and focus returns to the tile.
  3. A memorial using an Ordinary Time prayer shows the note and the Ordinary Time
     heading.
  4. A Sunday shows the "no prayers" note and **Use other prayers** works.
  5. Edit a reading, download, confirm the file has the edit; closing with unsaved
     edits asks first.
  6. Select several days: the button is the most visible control; Weekdays ticks
     the month's weekdays; ticks survive changing month; Clear works.
  7. Make files for 3 days, cancel one run, run again, download ZIP and master file.
  8. Prayers: open, edit, save, duplicate, delete a template; type in a prayer.
  9. Settings: toggle placeholders, save, confirm a Sunday now resolves.
  10. Keyboard only: reach every control, arrow through the month, open and close a
      book. Reduced motion: the book appears without animation.
  11. Window at 1024px and 900px wide: nothing overlaps or scrolls sideways.

## 10. Out of scope

- Changing the Word document's layout or wording.
- Dark mode.
- Sunday Prayers of the Faithful content.
- Phone-first layouts beyond the stacking in 6.4.
