# 1. Proposal

## What the app is for, in one sentence

LiturgyGen lets the Campus Ministry Office pick the days it has a Mass and come
away with printable Word missalettes — the liturgical day worked out, the
readings fetched, and the right Prayers of the Faithful attached — instead of
assembling each one by hand.

## Who it is for

The Campus Ministry Office staff and the student assistants who prepare the
printed reading guides for campus Masses.

This said "one office, one or two computers" when it was written, and the
accounts work changed it: a parish signs up, founds its own library, and sees
nobody else's. The office it was built for is still the one it was measured
against — the missalette specification, the ORDO overlay and the order of the
prayer cascade all come from watching them work — but the software is no longer
theirs alone, which is why the chapel's seal is no longer the app's mark. The
unit of use is a parish, and there may be several.

In the moment they open it they are trying to do one thing: select a date or a
batch of dates, see what the day keeps, and download a `.docx` laid out exactly
like the office's existing printed missalette, ready to send to the printer.

What they do today, per day of Mass: look up the liturgical day in the printed
ORDO; find the readings on the USCCB site; paste them into Word and format them
to the office's specification; flip through two physical volumes of General
Intercessions to find the matching prayers; then fix the layout. For a month of
weekday Masses that is more than twenty repetitions of the same work.

## Sections

Five, and the app has no client-side router: four are tabs held in one piece of
state in `App`, and the fifth opens over whichever tab is showing. The server
serves two paths — `/` for the landing page and `/app` for the application — and
nothing inside the application changes the URL.

| # | Section | What it is for |
| - | --- | --- |
| 1 | Calendar | The month as tiles, each with its liturgical colour and what the day keeps. Click one to open it; or turn on "Select several days" to tick a batch and make all of them at once. |
| 2 | Day book | Opens over the calendar as a dialog. The day and what to do with it on the left page; the missalette exactly as it will print on the right. Readings can be corrected, other prayers chosen, and the Word file downloaded from here. |
| 3 | Prayers | The Prayers of the Faithful library: search, edit, and **Type in** a page straight out of the General Intercessions books. Also where the prayer-book importer is reached. |
| 4 | Settings | Document defaults — the font, which optional parts print, the psalm-refrain rules, standing school-wide intentions. |
| 5 | Account | Who is signed in, which parish, and signing out. **Only present when accounts are on** — the tab is filtered out of the navbar entirely in the desktop build and in demo mode, rather than shown and disabled, because a tab that opens nothing is worse than a tab that is not there. |

Each one earns its place: remove the Calendar and there is no way to choose a
day; remove the Day book and there is no way to check one before it prints;
remove Prayers and the books can never be entered; remove Settings and the
office cannot make the output match the missalette they already use; remove
Account and a parish cannot tell whose library it is looking at.

Two more screens exist but are not sections, because neither is a place you can
navigate to: **sign in / create an account**, and **name your parish**. A new
account passes through them once and can never reach them again from the
navbar — they are steps, not destinations. An offer to import a prayer book
follows, and is skippable.

## State

For the busiest screen, the Calendar with a day book open over it.

| Data | Shape | Owner | Changes when |
| --- | --- | --- | --- |
| `tab` | `'calendar' \| 'prayers' \| 'settings' \| 'account'` | `App` | a navbar tab is clicked, in the top bar or the phone's bottom bar |
| `settings` | the document defaults object | `App` | Settings is saved |
| `templates` | `[{ id, title, season, week, dayOfWeek, celebrationId, fixedDate, priestInvitation, responseOptions[], intentions[], priestConclusion, isPlaceholder, isActive }]` | `App` | a prayer is added, edited, duplicated or deleted |
| `seasons` | `string[]` | `App` | once, at boot |
| `cursor` | `{ year, month }` | `CalendarScreen` | the month is stepped or "Today" is pressed |
| `daysByDate` | `{ [iso]: liturgicalDay }` | `CalendarScreen` | a month is loaded — merged, not replaced, so days picked in another month can still be named |
| `selection` | `string[]` of ISO dates | `CalendarScreen` | days are ticked, or a shortcut expands |
| `checks` | `{ [iso]: { hasReadings, hasPsalmResponse, ... } }` | `CalendarScreen` | days are checked before a batch, and again after one |
| `openIso` | `string \| null` | `CalendarScreen` | a day tile is activated |
| `day`, `page`, `draft` | the composed day; which left page is showing; unsaved edits | `DayBook` | inside the book — thrown away when it closes, because an unsaved correction should not survive |
| `session` | `undefined \| null \| Session` | `App` | Supabase answers, or the session changes. Three states, not two: rendering the sign-in screen while still checking would flash it at somebody already signed in, on every load |
| `account` | `{ authDisabled, user, organisation, organisations }` from `GET /api/account` | `App` | sign-in resolves, or a parish is founded. `organisation` is the current one and `organisations` is every membership, so `account && (authDisabled \|\| organisation)` is the whole test for "does this person have a parish yet" |
| `offerImport` | `boolean` | `App` | a parish is founded. Local state rather than a flag on the parish, because it is an offer and not a milestone — skipping it must not leave something behind for later code to interpret |

State lives in the lowest component that needs it. `templates` and `settings`
are the deliberate exception: the Calendar, the day book and the Prayers screen
all read them, so `App` is the lowest component that sees all three. The three
account values sit in `App` for the same reason and one more — until `session`
has resolved there is no screen to render at all, so the decision cannot live
below the thing doing the rendering.

## Content gathered

- `romcal` with the Philippine particular calendar, plus a local ORDO overlay
  for the celebrations romcal does not carry.
- The office's sample missalette, measured: margins, Book Antiqua, and the
  right tab stop at 9630 twips.
- The chapel seal, originally for the navbar and the splash screen — **no
  longer used.** It is one parish's identity, not the application's, and the
  accounts work made that a problem rather than a detail. Replaced by an
  inline-SVG open missal with a gold ribbon; see `03-design-system.md`.
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
