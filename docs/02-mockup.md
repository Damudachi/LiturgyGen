# 2. Mockup and component breakdown

The full document, with the rendered screen map and the wireframes drawn at both
widths, is a Word file kept outside this repository. This is the part that is
useful to somebody reading the code.

## Screen map

```
                 open LiturgyGen (desktop icon -> splash -> Calendar)
                                    |
  +---------------------------------+---------------------------------+
  |               NAVBAR - on every tab, one click back                |
  +---------+----------------------------+--------------------------+-+
            |                            |                          |
      TAB Calendar                  TAB Prayers               TAB Settings
            |                            |                          |
   +--------+--------+           +-------+-------+                Save /
   |                 |           |               |            Clear cached
 Making panel   DAY BOOK      Prayer book     Type in          (stays put)
 (select        (dialog)       (inline)
  several)          |
                    +-- Edit this page
                    +-- Use other prayers
                    +-- Paste from USCCB
                            (each has Back)
```

Answers to the three questions the map has to settle:

- **First screen:** the Calendar, on the current month, with today marked. No
  login and no setup step.
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

The month grid stays seven columns at every width. A month has seven days; a
calendar that stacks into a list stops being a calendar. The tiles get narrower
instead, down to a 4.5rem minimum height.

## Component tree

| Level | Components |
| --- | --- |
| **Atoms** (`components/ui.jsx`) | `Button`, `LinkButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Badge`, `Alert`, `Note`, `Spinner`, `EmptyState`, `Card`, `Disclosure` |
| **Molecules** | `DayTile`, `SelectSeveralButton`, `SelectionShortcuts`, `PrayerPicker`, `TemplateForm`, `TypeInPrayer`, `PasteReadings`, `WindowControls`, `DemoNotice` |
| **Organisms** | `MonthGrid`, `MakingPanel`, `TemplateList`, `DocumentPreview`, `DayPage`, `EditPage`, `Book`, `SettingsPanel` |
| **Screens / layout** | `CalendarScreen`, `DayBook`, `PrayersScreen`, `App` |

A level uses the levels below it and never above. Two repeats that pay for
themselves:

- **`DayTile`** renders thirty-five times per month, keyed by ISO date — which
  is also how the arrow-key focus tracking knows which tile is which.
- **`Book`** is written once and used twice, differently: as a modal dialog over
  the calendar (`variant="overlay"`) and inline on the Prayers screen
  (`variant="inline"`). It knows nothing about liturgy; the caller hands it a
  left page and a right page. Finding that the day view and the prayer editor
  were the same shape is the single thing the wireframing step paid for.
