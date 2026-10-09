# 2. Mockup and component breakdown

The full document, with the rendered screen map and the wireframes drawn at both
widths, is a Word file kept outside this repository. This is the part that is
useful to somebody reading the code.

## Screen map

```
  open LiturgyGen
        |
        +-- SIGNED OUT ----------------------------------------------+
        |     /        the landing page (server-rendered, no React)  |
        |     |            |                                        |
        |     |         Sign in --> /app                             |
        |     v                                                      |
        |   ENTRY SPREAD  cover leaf | paper leaf                    |
        |     Sign in <--> Create an account                          |
        |            |                                               |
        |     no parish yet --> SET UP YOUR PARISH                    |
        |                            |                               |
        |                     IMPORT YOUR BOOK (offered once, skippable)
        +------------------------------+-----------------------------+
                                       |
  +------------------------------------+------------------------------+
  |               NAVBAR - on every tab, one click back               |
  |   >= 768px: mark + wordmark left, the four tabs right             |
  |   <  768px: mark + wordmark only - the tabs move to the bottom    |
  +---------+---------------+----------------+----------------+-------+
            |               |                |                |
      TAB Calendar     TAB Prayers      TAB Settings      TAB Account
            |               |                |             (only when
   +--------+-----+    +----+----+---+     Save /          accounts are on)
   |              |    |         |   |   Clear cached
 Making panel  DAY BOOK  Prayer  Type  Import
 (select       (dialog)   book    in    a book
  several)        |      (inline)
                  +-- Edit this page
                  +-- Use other prayers
                  +-- Paste from USCCB
                          (each has Back)

  +-------------------------------------------------------------------+
  |        BOTTOM TAB BAR - phones only, below 768px                  |
  |   [ icon ]    [ icon ]     [ icon ]      [ icon ]                 |
  |  Calendar     Prayers      Settings      Account                  |
  +-------------------------------------------------------------------+
```

Answers to the three questions the map has to settle:

- **First screen:** depends on who is asking. A stranger gets the landing page
  at `/`. Somebody signed in lands on the Calendar, current month, today marked.
  A brand-new account passes through two one-off steps — name your parish, then
  an offer to import your prayer book — and neither can be reached again from
  the navbar, because neither is a place.
  With accounts off (a local checkout, the desktop build) the whole signed-out
  branch is skipped and the Calendar is the first screen, as it was before.
- **Home base:** the navbar. It is on every tab, and in the desktop build it is
  also the window's title bar. On a phone it splits in two — the mark and the
  wordmark stay at the top, the four tabs move to a fixed bar along the bottom,
  where a thumb can reach them. They are the same four tabs driving the same
  one piece of state in `App`, rendered twice with `max-md:hidden` and
  `md:hidden`, so there is no second navigation model to keep in step. Below
  768px each tab also gets a mark above its label (`lucide-react`), because a
  phone-width bar has room for four labels only if they are small enough to
  stop being readable.
- **Dead ends:** none. The day book closes on its button, on Escape, or on a
  click on the dim layer; each inner page has its own Back. A book with unsaved
  edits asks before discarding them.

## What stacks, and where

| Screen | Desktop (>= 1024px) | Phone (375px) |
| --- | --- | --- |
| Navbar | mark and wordmark left, the four tabs right | mark and wordmark only, at `--app-header`; the tabs are a fixed bottom bar at `--app-nav` |
| Calendar | month section left, making panel right at 29% (min 20rem) | one column; the header row wraps; the panel drops below the month and swaps its left border for a top border; padding and gaps tighten |
| Day book | two paper pages side by side, gutter between | one scrolling column, left page then missalette; gutter shading off below 900px |
| Prayers | `grid-cols-[22rem_minmax(0,1fr)]` — list left, book right | one column: list, then the book below it |
| Settings | one column of cards, capped at 48rem and centred | the same column, now edge to edge |
| Entry spread | two leaves, `1.08fr 0.92fr`, ink cover left and paper right, gold ribbon straddling the seam | the leaves stack: cover block, a flat gold rule along the fold, then the form |
| Account | one column capped at 2xl | the same, edge to edge |

### The two bars, as one pair of numbers

`index.css` declares `--app-header: 60px` and `--app-nav: 0px` on `:root`, and a
single `@media (max-width: 767px)` block raises `--app-nav` to
`calc(56px + env(safe-area-inset-bottom, 0px))` — the bar itself plus whatever
the phone keeps for its home indicator.

Everything that has to clear a bar reads the variable rather than a literal:
`<main>` carries `pb-[var(--app-nav)]`, and the day book's overlay is pinned to
both at once — `top-[var(--app-header)] bottom-[var(--app-nav)]` on one line in
`Book.jsx`. The height used to be a literal `60px` written out in two files, and
the overlay's `top-[60px]` was a silent promise about a number living in
`App.jsx`. With the phone bar there are two such numbers, and the book has to
clear both. **Nothing in the build would have reported the drift** — the book
would simply have sat a few pixels under the bar — which is the whole argument
for naming them.

### The month grid

The month grid stays seven columns at every width. A week has seven days; a
calendar that stacks into a list stops being a calendar. The tiles get narrower
instead, down to a **3.5rem** minimum row height. That floor was 4.5rem until a
six-row month stopped fitting a 1366×768 laptop — six rows needed 462px and the
screen left about 452px, so the last week was clipped in a container that does
not scroll. `MonthGrid.jsx` carries the arithmetic in a comment.

Below **640px** the tile sheds everything that is not the date. A 375px screen
divided seven ways is about 50px of tile, which is not enough for a liturgical
day's name at any readable size, so: the label is hidden, padding drops, the
weekday headings condense to single letters, today's date becomes a filled navy
disc instead of a date plus the word "Today", and the corner badges become a row
of small marks along the tile's foot. What survives is the date number and the
liturgical colour stripe — which is the minimum a calendar has to be, because a
tile you cannot read the date on is not a calendar tile. The day book is one tap
away and carries the full name.

## Component tree

| Level | Components | Where |
| --- | --- | --- |
| **Atoms** | `Button`, `LinkButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Badge`, `Alert`, `Note`, `Spinner`, `EmptyState`, `Card`, `Disclosure` | `components/ui.jsx` |
| **Molecules** | `DayTile`, `SelectSeveralButton`, `SelectionShortcuts` | `components/calendar/` |
| | `PrayerPicker`, `PasteReadings` | `components/day/` |
| | `TemplateForm`, `TypeInPrayer` | `components/prayers/` |
| | `WindowControls`, `DemoNotice`, `Logo` | `components/` |
| **Organisms** | `MonthGrid`, `MakingPanel` | `components/calendar/` |
| | `Book`, `DocumentPreview`, `DayPage`, `EditPage` | `components/` and `components/day/` |
| | `TemplateList`, `ImportBook` | `components/prayers/` |
| | `SettingsPanel` | `components/` |
| **Screens / layout** | `CalendarScreen`, `DayBook`, `PrayersScreen`, `SettingsPanel`, `AccountScreen`, `App` | one per folder, plus `App.jsx` |
| **Signed out** | `EntryLayout` — the shared spread — with `AuthScreen` and `ParishSetup` filling its paper leaf | `components/auth/` |

The folders are the four areas of the app — `calendar/`, `day/`, `prayers/`,
`auth/` — with `ui.jsx` and the three genuinely cross-cutting pieces (`Book`,
`Logo`, `WindowControls`) at the top of `components/`. `Book` sits there rather
than in `day/` because the Prayers screen uses it too, which is the point of it.

`server/src/views/pages.js` renders the same signed-out spread at `/` without
React, so a host with no client build still answers the front door.

Icons are `lucide-react`, imported one at a time rather than as a set. They are
`aria-hidden` wherever a text label sits beside them, which on the bottom tab
bar is always.

A level uses the levels below it and never above. Two repeats that pay for
themselves:

- **`DayTile`** renders once per day of the month — twenty-eight to thirty-one
  times — keyed by ISO date, which is also how the arrow-key focus tracking
  knows which tile is which. `monthGrid()` pads the grid to a whole number of
  weeks with `null`, and a `null` cell draws a blank, not a tile; the grid is
  five or six rows depending on where the first of the month falls.
- **`Book`** is written once and used twice, differently: as a modal dialog over
  the calendar (`variant="overlay"`) and inline on the Prayers screen
  (`variant="inline"`). It knows nothing about liturgy; the caller hands it a
  left page and a right page. Finding that the day view and the prayer editor
  were the same shape is the single thing the wireframing step paid for.
