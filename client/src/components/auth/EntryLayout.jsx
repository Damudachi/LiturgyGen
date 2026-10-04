import Logo from '../Logo.jsx';

/**
 * The shell every signed-out screen sits in: an opened missal.
 *
 * The left leaf is the cover - the mark, what the tool does, and how it does
 * it. The right leaf is paper, and holds whatever the visitor has to fill in.
 * One gold ribbon hangs in the seam between them.
 *
 * WHY A WHOLE LEAF OF PROSE
 * -------------------------
 * A parish office reaches this page having been sent a link by whoever set the
 * tool up, often with no idea what it is. A lone sign-in box on an empty screen
 * answers none of that, and leaves a laptop's screen almost entirely unused.
 *
 * Both signed-out screens share this rather than owning a copy, so the seam
 * does not move by a pixel between signing in and naming your parish.
 */

const DEFAULT_POINTS = [
  {
    claim: 'The readings come already typed.',
    detail:
      "Pick a date and LiturgyGen fetches that day's lectionary from the USCCB — antiphons, psalm response and all three readings.",
  },
  {
    claim: 'Your prayers are kept, not retyped.',
    detail:
      'Transcribe a prayer once. The library offers it back every time its season comes round again.',
  },
  {
    claim: 'What comes out is a Word file.',
    detail:
      'Open it, move a line, print it. Whoever does the layout needs nothing new installed.',
  },
];

/*
 * The ribbon in the seam.
 *
 * This was six ribbons, one per liturgical colour. It read as a thin striped
 * comb rather than as a bookmark, and the white one disappeared against the
 * paper half. One gold ribbon is what the app already uses to mark an open day
 * (see components/Book.jsx), so it carries the same meaning with none of the
 * noise, and gold is the one accent this palette spends on the thing that
 * matters most.
 */
const RIBBON_SHADOW =
  'inset 0 0 0 1px rgba(27, 39, 64, 0.18), 0 3px 10px rgba(27, 39, 64, 0.38)';

export default function EntryLayout({
  headline = 'Worship aids for every Mass, without retyping a word.',
  lede = "LiturgyGen takes a date, finds the readings appointed for it, adds the prayers your parish already uses, and hands back a document you can print.",
  points = DEFAULT_POINTS,
  children,
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="leaf-cover on-dark relative px-6 py-12 text-page sm:px-10 lg:px-16 lg:py-14">
        {/* Straddles the seam on a wide screen, so it reads as sewn into the
            spine rather than printed on the cover. */}
        <span
          aria-hidden="true"
          className="ribbon ribbon-drop pointer-events-none absolute top-0 right-0 z-10 hidden w-[34px] translate-x-1/2 bg-gold lg:block"
          style={{ height: '13rem', boxShadow: RIBBON_SHADOW }}
        />

        <div className="mx-auto flex min-h-full max-w-[34rem] flex-col lg:mx-0">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-12 shrink-0" />
            <span className="font-serif text-[22px] font-bold tracking-tight">LiturgyGen</span>
          </div>

          <h1 className="mt-9 font-serif text-[clamp(2.125rem,3.1vw,3rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-page-hi lg:mt-12">
            {headline}
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[#c9d3dc]">{lede}</p>

          <dl className="mt-10 lg:mt-12">
            {points.map((point) => (
              <div key={point.claim} className="border-t border-gold/25 py-[18px]">
                <dt className="font-serif text-[19px] font-semibold text-page-hi">{point.claim}</dt>
                <dd className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-[#b6c2cf]">{point.detail}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-sm text-[#8d9aad] lg:mt-auto lg:pt-12">
            Built for the Chapel of the Holy Guardian Angel.
          </p>
        </div>

        {/* Stacked, the ribbon lies flat along the fold instead. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2.5 bg-gold lg:hidden" />
      </section>

      <section className="leaf-paper flex items-center px-6 py-14 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[26rem]">{children}</div>
      </section>
    </div>
  );
}
