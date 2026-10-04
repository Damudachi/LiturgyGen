import seal from '../../assets/seal-128.png';

/**
 * The shell every signed-out screen sits in: an opened missal.
 *
 * The left leaf is the cover - the seal, what the tool does, and how it does
 * it. The right leaf is paper, and holds whatever the visitor has to fill in.
 * Sewn into the seam are the six liturgical colours, cut as ribbon markers.
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

/* Violet, white, green, red, rose, gold - the year in the order it is worn,
 * at the uneven lengths ribbons actually fall to in a bound missal. */
const RIBBONS = [
  { color: 'var(--color-lit-violet)', height: '7.5rem' },
  { color: 'var(--color-lit-white)', height: '10rem' },
  { color: 'var(--color-lit-green)', height: '6.25rem' },
  { color: 'var(--color-lit-red)', height: '8.75rem' },
  { color: 'var(--color-lit-rose)', height: '5.5rem' },
  { color: 'var(--color-lit-gold)', height: '7rem' },
];

export default function EntryLayout({
  headline = 'Worship aids for every Mass, without retyping a word.',
  lede = "LiturgyGen takes a date, finds the readings appointed for it, adds the prayers your parish already uses, and hands back a document you can print.",
  points = DEFAULT_POINTS,
  children,
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="leaf-cover on-dark relative px-6 py-12 text-page sm:px-10 lg:px-16 lg:py-14">
        {/* The ribbons straddle the seam on a wide screen, so they read as sewn
            into the spine rather than printed on the cover. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 z-10 hidden translate-x-1/2 gap-[5px] lg:flex"
        >
          {RIBBONS.map((ribbon, index) => (
            <span
              key={ribbon.color}
              className="ribbon ribbon-drop block w-[7px] shadow-[0_2px_6px_rgba(27,39,64,0.35)]"
              style={{ height: ribbon.height, background: ribbon.color, animationDelay: `${index * 70}ms` }}
            />
          ))}
        </div>

        <div className="mx-auto flex min-h-full max-w-[34rem] flex-col lg:mx-0">
          <div className="flex items-center gap-3">
            <img src={seal} alt="" draggable={false} className="size-11 rounded-full ring-1 ring-gold/30" />
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

        {/* Stacked, the ribbons lie flat along the fold instead. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-1 lg:hidden">
          {RIBBONS.map((ribbon) => (
            <span key={ribbon.color} className="flex-1" style={{ background: ribbon.color }} />
          ))}
        </div>
      </section>

      <section className="leaf-paper flex items-center px-6 py-14 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[26rem]">{children}</div>
      </section>
    </div>
  );
}
