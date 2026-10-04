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
  also the window's title bar.
- **Dead ends:** none. The day book closes on its button, on Escape, or on a
  click on the dim layer; each inner page has its own Back. A book with unsaved
  edits asks before discarding them.

## What stacks, and where

| Screen | Desktop (>= 1024px) | Phone (375px) |
| --- | --- | --- |
| Calendar | month section left, making panel right at 29% (min 20rem) | one column; the header row wraps; the panel drops below the month and swaps its left border for a top border |
| Day book | two paper pages side by side, gutter between | one scrolling column, left page then missalette; gutter shading off below 900px |
| Prayers | `grid-cols-[22rem_minmax(0,1fr)]` — list left, book right | one column: list, then the book below it |
| Settings | one column of cards, capped at 48rem and centred | the same column, now edge to edge |
| Entry spread | two leaves, `1.08fr 0.92fr`, ink cover left and paper right, gold ribbon straddling the seam | the leaves stack: cover block, a flat gold rule along the fold, then the form |
| Account | one column capped at 2xl | the same, edge to edge |

The month grid stays seven columns at every width. A month has seven days; a
calendar that stacks into a list stops being a calendar. The tiles get narrower
instead, down to a 4.5rem minimum height.

## Component tree

| Level | Components |
| --- | --- |
| **Atoms** (`components/ui.jsx`) | `Button`, `LinkButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Badge`, `Alert`, `Note`, `Spinner`, `EmptyState`, `Card`, `Disclosure` |
| **Molecules** | `DayTile`, `SelectSeveralButton`, `SelectionShortcuts`, `PrayerPicker`, `TemplateForm`, `TypeInPrayer`, `PasteReadings`, `WindowControls`, `DemoNotice`, `Logo` |
| **Organisms** | `MonthGrid`, `MakingPanel`, `TemplateList`, `DocumentPreview`, `DayPage`, `EditPage`, `Book`, `SettingsPanel`, `ImportBook` |
| **Screens / layout** | `CalendarScreen`, `DayBook`, `PrayersScreen`, `SettingsPanel`, `AccountScreen`, `App` |
| **Signed out** (`components/auth/`) | `EntryLayout` — the shared spread — with `AuthScreen` and `ParishSetup` filling its paper leaf. `server/src/views/pages.js` renders the same spread at `/` without React |

A level uses the levels below it and never above. Two repeats that pay for
themselves:

- **`DayTile`** renders thirty-five times per month, keyed by ISO date — which
  is also how the arrow-key focus tracking knows which tile is which.
- **`Book`** is written once and used twice, differently: as a modal dialog over
  the calendar (`variant="overlay"`) and inline on the Prayers screen
  (`variant="inline"`). It knows nothing about liturgy; the caller hands it a
  left page and a right page. Finding that the day view and the prayer editor
  were the same shape is the single thing the wireframing step paid for.
