# 1. Proposal

## What the app is for, in one sentence

LiturgyGen lets the Campus Ministry Office pick the days it has a Mass and come
away with printable Word missalettes — the liturgical day worked out, the
readings fetched, and the right Prayers of the Faithful attached — instead of
assembling each one by hand.

## Who it is for

The Campus Ministry Office staff and the student assistants who prepare the
printed reading guides for campus Masses. One office, one or two computers.

In the moment they open it they are trying to do one thing: select a date or a
batch of dates, see what the day keeps, and download a `.docx` laid out exactly
like the office's existing printed missalette, ready to send to the printer.

What they do today, per day of Mass: look up the liturgical day in the printed
ORDO; find the readings on the USCCB site; paste them into Word and format them
to the office's specification; flip through two physical volumes of General
Intercessions to find the matching prayers; then fix the layout. For a month of
weekday Masses that is more than twenty repetitions of the same work.

## Sections

Four, and the app has no URL routing: three are tabs held in one piece of state
in `App`, and the fourth opens over whichever tab is showing.

| # | Section | What it is for |
| - | --- | --- |
| 1 | Calendar | The month as tiles, each with its liturgical colour and what the day keeps. Click one to open it; or turn on "Select several days" to tick a batch and make all of them at once. |
| 2 | Day book | Opens over the calendar as a dialog. The day and what to do with it on the left page; the missalette exactly as it will print on the right. Readings can be corrected, other prayers chosen, and the Word file downloaded from here. |
| 3 | Prayers | The Prayers of the Faithful library: search, edit, and **Type in** a page straight out of the General Intercessions books. |
| 4 | Settings | Document defaults — the font, which optional parts print, the psalm-refrain rules, standing school-wide intentions. |

Each one earns its place: remove the Calendar and there is no way to choose a
day; remove the Day book and there is no way to check one before it prints;
remove Prayers and the books can never be entered; remove Settings and the
office cannot make the output match the missalette they already use.

## State

For the busiest screen, the Calendar with a day book open over it.

| Data | Shape | Owner | Changes when |
| --- | --- | --- | --- |
| `tab` | `'calendar' \| 'prayers' \| 'settings'` | `App` | a navbar tab is clicked |
| `settings` | the document defaults object | `App` | Settings is saved |
| `templates` | `[{ id, title, season, week, dayOfWeek, celebrationId, fixedDate, priestInvitation, responseOptions[], intentions[], priestConclusion, isPlaceholder, isActive }]` | `App` | a prayer is added, edited, duplicated or deleted |
| `seasons` | `string[]` | `App` | once, at boot |
| `cursor` | `{ year, month }` | `CalendarScreen` | the month is stepped or "Today" is pressed |
| `daysByDate` | `{ [iso]: liturgicalDay }` | `CalendarScreen` | a month is loaded — merged, not replaced, so days picked in another month can still be named |
| `selection` | `string[]` of ISO dates | `CalendarScreen` | days are ticked, or a shortcut expands |
| `checks` | `{ [iso]: { hasReadings, hasPsalmResponse, ... } }` | `CalendarScreen` | days are checked before a batch, and again after one |
| `openIso` | `string \| null` | `CalendarScreen` | a day tile is activated |
| `day`, `page`, `draft` | the composed day; which left page is showing; unsaved edits | `DayBook` | inside the book — thrown away when it closes, because an unsaved correction should not survive |

State lives in the lowest component that needs it. `templates` and `settings`
are the deliberate exception: the Calendar, the day book and the Prayers screen
all read them, so `App` is the lowest component that sees all three.

## Content gathered

- `romcal` with the Philippine particular calendar, plus a local ORDO overlay
  for the celebrations romcal does not carry.
- The office's sample missalette, measured: margins, Book Antiqua, and the
  right tab stop at 9630 twips.
- The chapel seal, for the navbar and the splash screen.
- The office's transcriptions of the two General Intercessions volumes — which
  stay out of this repository permanently, because they are copyrighted.

## The risk

Fetching readings from USCCB, which runs a proof-of-work bot challenge against
automated clients.

This turned out to be exactly as named, and the measurements are now known:
past the challenge the site hands out a grace cookie good for about ten to
fifteen seconds — eight to eleven dates — after which requests are refused for
roughly three minutes, and any request made while blocked restarts that clock.
The mitigation is therefore the opposite of going slower: keep the cookie, spend
it fast, then stop completely. Everything fetched is cached permanently (the
readings for a past date never change), Evangelizo is the fallback, and a paste
box covers the date nothing else reaches.

Solving the challenge is out of scope on purpose. It is an access control
somebody put there deliberately.
