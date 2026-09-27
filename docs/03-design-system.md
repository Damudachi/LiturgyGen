# 3. Design system

Palette **"Vellum"**, taken from the Chapel of the Holy Guardian Angel seal:
navy ink and gold on the paper of a missal.

The full document, with the palette as rendered swatches and the type scale set
at its real sizes, is a Word file kept outside this repository. Everything here
is the working reference.

## Approach

**Tailwind CSS v4** through `@tailwindcss/vite`. Every token is a CSS custom
property in the single `@theme { }` block at the top of `client/src/index.css`,
which Tailwind turns into utilities: `--color-gold` becomes `bg-gold`,
`text-gold`, `ring-gold`. There is no `tailwind.config.js` in this project.

No UI library. The five atoms a library would have supplied — Button, Input,
Select, Checkbox, Card — are about ninety lines in `ui.jsx`. The components the
app actually depends on are `Book`, `DayTile` and `DocumentPreview`, and nobody
ships a two-page missal spread with a gutter and a ribbon.

## Colour

| Token | Role | Hex |
| --- | --- | --- |
| `--color-ink` | body text, the navbar, the primary button | `#1B2740` |
| `--color-navy` | links, the focus ring, chosen and current states | `#263551` |
| `--color-gold` | the one action on a screen that matters most | `#F2BC1B` |
| `--color-bg` | the page background | `#F4EFE3` |
| `--color-page` | cards, panels, the book's paper | `#F7F2E6` |

Supporting: `--color-muted` `#4F5669`, `--color-edge` `#DCD3BE`, `--color-tile`
`#E7E8DF`, `--color-page-hi` `#FCFAF4`, `--color-note` `#FBEFC4`,
`--color-note-ink` `#3F3300`, `--color-ok` `#2E7D4F`, `--color-bad` `#B3261E`,
`--color-gold-edge` `#C99500`.

Seven more are **data, not design**: the liturgical colours (green, violet, red,
rose, gold, white, black), painted as a 5px stripe along the top of each day
tile. They are the colour the Church assigns the day, so nothing else in the
interface borrows one. White is an ivory `#FFFDF6` with a darker inset edge,
because a true white stripe disappears against the paper.

### Contrast, measured

| Pair | Ratio |
| --- | --- |
| ink on bg | 12.97 : 1 |
| ink on page | 13.32 : 1 |
| muted on page | 6.56 : 1 |
| navy on tile | 9.94 : 1 |
| page on ink (navbar) | 13.32 : 1 |
| gold on ink (active tab) | 8.49 : 1 |
| ink on gold (the gold button) | 8.49 : 1 |
| note-ink on note | 10.83 : 1 |
| ok on page | 4.52 : 1 |
| bad on page | 5.85 : 1 |

Eleven pairs measured; the weakest real pair is 4.52 : 1 against a 4.5 : 1
target.

**One known failure.** `--color-gold-edge` (`#C99500`) is the fill of the small
"needs a look" triangle in the making panel: **2.42 : 1** against the page, which
fails even the 3 : 1 asked of a meaningful graphic. It is never carrying meaning
alone — every one of those icons sits beside a text label saying the same thing,
and the icon carries an `aria-label` — but it should be darkened to `#8A6500`
(4.64 : 1). Open.

## Type

| Style | Font | Size | Used for |
| --- | --- | --- | --- |
| Heading | Newsreader (serif) | 32px, 600 | screen titles |
| Subheading | Newsreader (serif) | 20–28px, 600–700 | card titles, the occasion in a day book |
| Body | Source Sans 3 | 16px, 400 | everything you read |
| Small | Source Sans 3 | 14px, 400 | captions, hints, tile labels |
| Print | Book Antiqua | 15px | the missalette preview only |

Anything that names a liturgical day is set in the serif, because that is how a
missal sets them and because it separates *what the Church calls this day* from
*what the app is asking you to do*.

The third face exists for one reason: Book Antiqua is what the generated `.docx`
prints in, because it is what the office's existing missalette uses. The preview
on the right-hand page uses the same face at the same relative size, so what is
on screen is what comes out of the printer. That is the whole reason the preview
exists.

## Spacing and depth

One base unit, 4px, and four steps: **6px** (`gap-1.5`, tile internals), **12px**
(`gap-3`, controls in a row), **20px** (`p-5`, inside every card and panel),
**24px** (`px-6`, the screen edge).

Radius 8–12px on panels and buttons; fully round on the pill actions, so the
shape itself reads as "this is an action".

Three shadow tokens only — `--shadow-rest` (lying on the page), `--shadow-raise`
(under the pointer or chosen), `--shadow-float` (the navbar, the side panel) —
all tinted with the palette's navy rather than grey, so they sit in the same warm
light as the paper. `.lift` pairs the raise shadow with a 2px upward translate,
and drops the translate under `prefers-reduced-motion`.

## Responsive

| Breakpoint | Class | What changes |
| --- | --- | --- |
| below 900px | `max-[899px]` | the book's two pages become one column; gutter shading off |
| below 1024px | `max-[1023px]` | the making panel drops below the month; the Prayers list column goes full width |
| 1024px and up | `min-[1024px]` | the panel returns to 29%; Prayers returns to two columns |

Each was written because a specific layout broke at that width, not because a
framework offered a set. At 375px nothing scrolls sideways.

## Accessibility

- Real elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<aside>`,
  `<ul>`/`<li>`, and twenty real `<button>`s. A day tile is a `<button>`, which
  is what makes it keyboard-reachable for free.
- One image in the app, the chapel seal, and it carries alt text. Icons are
  `aria-hidden` because each sits beside a text label; the few that stand alone
  carry an `aria-label`.
- The `Field` atom renders a real `<label>` wrapping its input, so association
  is structural and cannot be forgotten. Controls outside a Field carry
  `aria-label`.
- One focus style for the whole app: a 3px navy outline with a 2px offset,
  switched to gold inside the dark navbar.
- The month grid supports arrow-key navigation with a roving tabindex, so a
  keyboard user moves between days rather than tabbing through thirty-five
  buttons. The day book traps Tab while open, closes on Escape, and returns
  focus to the tile that opened it.
- Every animation is dropped under `prefers-reduced-motion`.
