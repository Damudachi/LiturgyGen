/**
 * LiturgyGen's own mark: an open missal with a ribbon in the gutter.
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
 * The book takes `currentColor`, so one mark works on the navy header (where it
 * inherits cream) and on the paper leaf (where it inherits navy). An `<img>`
 * cannot inherit a colour, so this has to be inline SVG - which also means the
 * server's landing page can hold the same paths without depending on a
 * Vite-hashed asset that changes name on every build.
 *
 * The ribbon stays gold at every size. It is the one fixed colour, and it is
 * what makes the mark read as a missal rather than a generic book icon.
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
      {/* The two leaves. Stroked rather than filled, so the mark stays legible
          on the navy header and on cream paper without a second colour. */}
      <rect x="4.25" y="8.25" width="17.5" height="27.5" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
      <rect x="26.25" y="8.25" width="17.5" height="27.5" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
      {/* The ribbon, hanging in the gutter and notched at the tail. Drawn last
          so it sits over both leaves' inner edges, the way a real one does. */}
      <path d="M20.5 2h7v22l-3.5-3-3.5 3z" fill="#f2bc1b" />
    </svg>
  );
}
