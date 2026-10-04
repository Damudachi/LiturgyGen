/**
 * LiturgyGen's own mark: an open missal, gilt-edged, with a ribbon in the spine.
 *
 * WHY THIS IS NOT THE CHAPEL SEAL
 * -------------------------------
 * The header and the entry screen used `assets/seal-128.png`, which is the
 * Chapel of the Holy Guardian Angel's own seal. That is the chapel's identity,
 * not the app's: it belongs to one parish, and the whole point of the accounts
 * work is that LiturgyGen serves more than one. A second parish signing in and
 * finding somebody else's seal in the corner would be right to wonder whose
 * software this is. The chapel is still named, in words, on the entry screen -
 * which is the accurate claim: built for them, not owned by them.
 *
 * WHY IT IS A COMPONENT AND NOT AN SVG FILE
 * -----------------------------------------
 * The leaves take `currentColor`, so one mark works on the navy header (where
 * it inherits cream) and on the paper leaf (where it inherits navy). An `<img>`
 * cannot inherit a colour, so this has to be inline SVG - which also means the
 * server's landing page can hold the same paths without depending on a
 * Vite-hashed asset that changes name on every build.
 *
 * WHY THE LEAVES ARE FILLED AND NOT OUTLINED
 * ------------------------------------------
 * The first version was two stroked rectangles and a ribbon, and it read as two
 * boxes rather than a book. Three things fixed it, and all three are about
 * surviving 32px in the header:
 *
 *   - Solid leaves. A filled silhouette holds its shape at small sizes where a
 *     1px outline turns to grey mush.
 *   - A dip toward the spine. The inner corners sit LOWER than the outer ones,
 *     which is what an open book does and what a pair of rectangles cannot say.
 *   - Gilt edges. A gold rule along each lower edge, set slightly outside the
 *     leaf so it reads as the gilded page block of a real missal. It is also
 *     the second mass of gold that stops the ribbon looking like a stray mark.
 *
 * The ribbon stays gold at every size and is drawn last, over the spine. Keep
 * this geometry in step with `client/public/favicon.svg` and the inline copy in
 * `server/src/views/pages.js`; nothing in the build will tell you when they
 * drift apart.
 */

export default function Logo({ className, title = 'LiturgyGen' }) {
  return (
    <svg
      viewBox="0 0 48 40"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* The gilded page block, under the leaves so only its edge shows. */}
      <path
        d="M4 31.8 22.6 35.3M44 31.8 25.4 35.3"
        stroke="#f2bc1b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* The two leaves, dipping toward the spine. */}
      <polygon points="4,7.5 22.6,11 22.6,34.5 4,31" fill="currentColor" />
      <polygon points="44,7.5 25.4,11 25.4,34.5 44,31" fill="currentColor" />
      {/* The ribbon, rising out of the spine and notched at the tail. */}
      <path d="M21.4 4h5.2v25l-2.6-2.4-2.6 2.4z" fill="#f2bc1b" />
    </svg>
  );
}
