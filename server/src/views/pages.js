/**
 * The two pages Express renders itself, rather than handing to React.
 *
 * WHY THESE ARE NOT REACT
 * -----------------------
 * Both are shown in situations where the React bundle is either not wanted or
 * not reachable:
 *
 *   landingPage()       is served at `/`, and is the first thing anybody sees.
 *                       Loading the whole app bundle to show a page with two
 *                       links on it is the wrong trade, so this is hand-written.
 *   unauthorizedPage()  is what a browser gets when a sign-in prompt is
 *                       cancelled. By definition nothing behind the gate can be
 *                       fetched at that moment, so it cannot depend on a single
 *                       asset - no stylesheet, no font file, no script.
 *
 * So both are one self-contained document each, with their styles inline.
 *
 * THIS PAGE MUST MATCH client/src/components/auth/EntryLayout.jsx
 * --------------------------------------------------------------
 * `/` and `/app` are one journey: a visitor reads this page and presses Sign in,
 * and the next thing they see is the React entry screen. So this page is the
 * same spread - an ink cover leaf on the left, a paper leaf on the right, and
 * a gold ribbon sewn into the seam between them. The headline, the
 * lede and the three points are deliberately the same words in both places.
 *
 * There is no build step that will tell you when the two drift apart. If you
 * change the copy or the spread in one, change it in the other.
 *
 * CONTENT SECURITY POLICY
 * -----------------------
 * `src/app.js` sets `styleSrc: ["'self'", "'unsafe-inline'"]` but
 * `scriptSrc: ["'self'"]` with no `'unsafe-inline'`. An inline <style> block is
 * therefore allowed and an inline <script> is NOT - it would be silently
 * blocked, which is a miserable thing to debug. Everything here is markup and
 * CSS; the buttons are plain links, so neither page needs a line of JavaScript.
 *
 * THE MARK IS INLINE SVG, NOT AN IMAGE
 * ------------------------------------
 * No `<img>` on either page, deliberately. A PNG would have to be Vite-hashed
 * inside `client/dist/assets`, so any path written here is correct until the
 * next build, and an API host deployed without a client build beside it has no
 * copy at all - a broken-image icon in the corner of the front door. The mark
 * is markup instead, so it cannot 404. Keep its geometry in step with
 * `client/src/components/Logo.jsx`; it is the same two leaves and the same
 * ribbon, drawn from the same numbers.
 *
 * COLOURS
 * -------
 * The "Vellum" palette from `client/src/index.css`, copied rather than imported
 * because that file is Tailwind source compiled into the client bundle and is
 * not readable from the server at run time. Only the tokens these pages use are
 * repeated here. If the palette changes there, change it here - again, there is
 * no build step that will tell you.
 *
 * Light only, and `color-scheme: light` says so. The app itself has no dark
 * mode, and a dark landing page in front of a cream app looks like a mistake.
 */

/**
 * The one script either page loads, and the reason it is a file.
 *
 * Supabase sends an email link to the project's Site URL, which is an ORIGIN -
 * so a confirmation or recovery link lands on `/`, and `/` is this
 * hand-written page with no React on it. The session, or the error, arrives in
 * the URL FRAGMENT. A fragment is never sent to the server, so nothing here
 * can read it and nothing here can act on it: without this, a perfectly valid
 * confirmation link drops somebody on the front door with their session
 * sitting unread in the address bar, and a dead one shows them a landing page
 * and a line of noise.
 *
 * So the fragment is handed to `/app`, where `detectSessionInUrl` consumes a
 * session and `AuthScreen` explains an error.
 *
 * It is a FILE, not an inline <script>, because `src/app.js` sets
 * `scriptSrc: ["'self'"]` with no `'unsafe-inline'`. An inline block would be
 * silently blocked. It is served by its own route rather than from the client
 * build, so it still works on a host with no `client/dist` beside it.
 *
 * Setting the project's Site URL to `<origin>/app` is the better fix and makes
 * this redundant. This stays because it costs 200 bytes and removes a whole
 * class of silent breakage - including the case where somebody changes that
 * setting back.
 */
export function authForwardScript() {
  return `(function () {
  var hash = window.location.hash;
  if (!hash || hash.length < 2) return;
  if (!/(^|[#&])(access_token|refresh_token|error|error_code|type)=/.test(hash)) return;
  window.location.replace('/app' + window.location.search + hash);
})();
`;
}


/** Shared head and styles, so the two pages cannot drift apart. */
function shell({ title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
<meta name="description" content="${description}">
<style>
  :root {
    color-scheme: light;
    --ink: #1b2740;
    --navy: #263551;
    --gold: #f2bc1b;
    --gold-edge: #c99500;
    --bg: #f4efe3;
    --page: #f7f2e6;
    --page-hi: #fcfaf4;
    --edge: #dcd3be;
    --muted: #4f5669;
    /* On the ink leaf, where --muted has nowhere near enough contrast. */
    --on-ink: #c9d3dc;
    --on-ink-dim: #b6c2cf;
    --on-ink-faint: #8d9aad;
    --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
    --sans: 'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif;
    --shadow-rest: 0 1px 2px rgba(27, 39, 64, 0.08), 0 3px 8px rgba(27, 39, 64, 0.09);
    --shadow-raise: 0 3px 6px rgba(27, 39, 64, 0.1), 0 12px 26px rgba(27, 39, 64, 0.16);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  /* ---------------------------------------------------------------- *
   * The spread: the opened missal, matching the app's entry screen.
   * ---------------------------------------------------------------- */

  .spread {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 100vh;
  }

  .leaf-cover {
    position: relative;
    padding: 3rem 1.5rem;
    color: var(--page);
    background-color: var(--ink);
    /* Gold light falling from the top-left corner, so the navy half reads as a
       surface rather than a coloured rectangle. */
    background-image:
      radial-gradient(118% 88% at 6% 0%, rgba(242, 188, 27, 0.11), rgba(242, 188, 27, 0) 56%),
      radial-gradient(85% 70% at 100% 100%, rgba(38, 53, 81, 0.85), rgba(38, 53, 81, 0) 62%);
  }

  .leaf-paper {
    display: flex;
    align-items: center;
    padding: 3.5rem 1.5rem;
    background: var(--page);
  }

  .leaf-inner { width: 100%; max-width: 34rem; margin: 0 auto; }
  .leaf-paper .leaf-inner { max-width: 26rem; }

  .wordmark {
    margin: 0;
    font-family: var(--serif);
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .brand svg { width: 2.5rem; height: 2.0833rem; flex: 0 0 auto; }

  .leaf-cover h1 {
    margin: 2.25rem 0 0;
    font-family: var(--serif);
    font-size: clamp(2.125rem, 3.1vw, 3rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--page-hi);
  }

  .lede {
    margin: 1.25rem 0 0;
    max-width: 46ch;
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--on-ink);
  }

  .points { margin: 2.5rem 0 0; }

  .point {
    padding: 18px 0;
    border-top: 1px solid rgba(242, 188, 27, 0.25);
  }

  .point h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: 1.1875rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--page-hi);
  }

  .point p {
    margin: 0.375rem 0 0;
    max-width: 52ch;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--on-ink-dim);
  }

  .leaf-cover footer {
    margin: 2.5rem 0 0;
    font-size: 0.875rem;
    color: var(--on-ink-faint);
  }

  /* ---------------------------------------------------------------- *
   * The one gold ribbon, sewn into the seam. This was six - one per
   * liturgical colour - and it read as a thin striped comb rather than as a
   * bookmark. Gold alone says the same thing, and matches the app.
   * ---------------------------------------------------------------- */

  .ribbon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: var(--gold);
    pointer-events: none;
  }

  /* ---------------------------------------------------------------- *
   * The paper leaf's own furniture.
   * ---------------------------------------------------------------- */

  .leaf-paper h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.015em;
    color: var(--navy);
  }

  .leaf-paper p { margin: 0.75rem 0 0; }
  .leaf-paper .muted { color: var(--muted); }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1.75rem 0 0;
  }

  a.btn {
    flex: 1 1 auto;
    min-width: 11rem;
    padding: 0.8rem 1.25rem;
    border-radius: 10px;
    font-family: var(--sans);
    font-size: 1.0625rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    box-shadow: var(--shadow-rest);
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  a.primary {
    background: var(--navy);
    border: 1px solid var(--ink);
    color: var(--page-hi);
  }

  a.secondary {
    background: var(--page-hi);
    border: 1px solid var(--edge);
    color: var(--navy);
  }

  a.btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-raise); }
  a.btn:active { transform: translateY(0); box-shadow: var(--shadow-rest); }

  /* The one visible focus ring, gold where it has to read on navy. */
  a:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
  .leaf-cover a:focus-visible { outline-color: var(--gold); }

  .note {
    margin-top: 1.75rem;
    padding: 0.875rem 1rem;
    background: var(--page-hi);
    border: 1px solid var(--edge);
    border-left: 3px solid var(--gold);
    border-radius: 6px;
    font-size: 0.9375rem;
    color: var(--muted);
  }

  .note strong { color: var(--ink); font-weight: 600; }

  .leaf-paper footer {
    margin-top: 1.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--edge);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .leaf-paper footer p { margin: 0.375rem 0 0; }
  .leaf-paper footer p:first-child { margin-top: 0; }
  .leaf-paper footer a { color: var(--navy); text-decoration-color: var(--edge); }
  .leaf-paper footer a:hover { text-decoration-color: var(--gold-edge); }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    background: var(--page-hi);
    border: 1px solid var(--edge);
    border-radius: 4px;
  }

  /* ---------------------------------------------------------------- *
   * A laptop opens the book. Below this width the two leaves stack and the
   * ribbon lies flat along the fold instead of hanging in the seam.
   * ---------------------------------------------------------------- */
  @media (min-width: 64rem) {
    .spread { grid-template-columns: 1.08fr 0.92fr; }

    .leaf-cover {
      display: flex;
      flex-direction: column;
      padding: 3.5rem 4rem;
    }

    .leaf-paper { padding: 3.5rem 3.5rem; }

    .leaf-cover .leaf-inner {
      margin: 0;
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    .leaf-cover footer { margin-top: auto; padding-top: 3rem; }

    .ribbon {
      left: auto;
      right: 0;
      width: 20px;
      height: 10.5rem;
      transform: translateX(50%);
      z-index: 1;
      /* The notched tail of a bookmark ribbon. */
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%);
      box-shadow:
        inset 0 0 0 1px rgba(27, 39, 64, 0.18),
        0 3px 10px rgba(27, 39, 64, 0.38);
    }
  }

  /* ---------------------------------------------------------------- *
   * The card, for unauthorizedPage(). An interstitial has one thing to say
   * and no reason to fill a screen, so it keeps the narrow form.
   * ---------------------------------------------------------------- */

  .card {
    justify-self: center;
    align-self: center;
    width: calc(100% - 2rem);
    max-width: 30rem;
    margin: 2rem 1rem;
    padding: 2.5rem 2rem;
    background: var(--page);
    border: 1px solid var(--edge);
    border-top: 3px solid var(--gold);
    border-radius: 10px;
    box-shadow: var(--shadow-rest);
  }

  @media (min-width: 30rem) {
    .card { padding: 3rem 2.75rem; }
  }

  .card h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--navy);
  }

  .card .sub {
    margin: 0.5rem 0 0;
    font-family: var(--serif);
    font-size: 1.0625rem;
    font-weight: 500;
    color: var(--muted);
  }

  .card p { margin: 0 0 1rem; }
  .card p:last-child { margin-bottom: 0; }

  .card footer {
    margin-top: 1.75rem;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .card footer a { color: var(--navy); text-decoration-color: var(--edge); }
  .card footer a:hover { text-decoration-color: var(--gold-edge); }

  .rule { height: 1px; margin: 1.75rem 0; background: var(--edge); border: 0; }

  @media (prefers-reduced-motion: reduce) {
    a.btn { transition: none; }
    a.btn:hover, a.btn:active { transform: none; }
  }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * The page at `/`, and the front door of the whole thing.
 *
 * It says what the app is, who it is for, and that it needs an account - so
 * somebody following the link from the repository understands what they are
 * about to be asked for. It names no credential and reveals no data.
 *
 * It used to be a 30rem card centred on an empty background, which on a laptop
 * read as an unfinished phone layout. It is now the same spread as the app's own
 * entry screen; see the note at the top of this file about keeping the two in
 * step.
 *
 * @param {{ demoUrl?: string, repoUrl?: string }} options
 */
export function landingPage({
  demoUrl = 'https://damudachi.github.io/LiturgyGen/',
  repoUrl = 'https://github.com/Damudachi/LiturgyGen',
} = {}) {
  return shell({
    title: 'LiturgyGen',
    description:
      'Mass readings missalette and Prayers of the Faithful generator for the Campus Ministry Office.',
    body: `<main class="spread">
  <section class="leaf-cover">
    <span class="ribbon" aria-hidden="true"></span>
    <div class="leaf-inner">
      <div class="brand">
        <svg viewBox="0 0 48 40" fill="none" role="img" aria-label="LiturgyGen">
          <rect x="4.25" y="8.25" width="17.5" height="27.5" rx="1.5" stroke="currentColor" stroke-width="2.5"/>
          <rect x="26.25" y="8.25" width="17.5" height="27.5" rx="1.5" stroke="currentColor" stroke-width="2.5"/>
          <path d="M20.5 2h7v22l-3.5-3-3.5 3z" fill="#f2bc1b"/>
        </svg>
        <p class="wordmark">LiturgyGen</p>
      </div>

      <h1>Worship aids for every Mass, without retyping a word.</h1>

      <p class="lede">LiturgyGen takes a date, finds the readings appointed for it, adds the
      prayers your parish already uses, and hands back a document you can print.</p>

      <div class="points">
        <div class="point">
          <h2>The readings come already typed.</h2>
          <p>Pick a date and LiturgyGen fetches that day&rsquo;s lectionary from the USCCB
          &mdash; antiphons, psalm response and all three readings.</p>
        </div>
        <div class="point">
          <h2>Your prayers are kept, not retyped.</h2>
          <p>Transcribe a prayer once. The library offers it back every time its season comes
          round again.</p>
        </div>
        <div class="point">
          <h2>What comes out is a Word file.</h2>
          <p>Open it, move a line, print it. Whoever does the layout needs nothing new
          installed.</p>
        </div>
      </div>

      <footer>Built for the Chapel of the Holy Guardian Angel.</footer>
    </div>
  </section>

  <section class="leaf-paper">
    <div class="leaf-inner">
      <h2>Sign in to your parish</h2>

      <p class="muted">Your prayer library, your house style and your Mass schedule belong to
      your parish &mdash; shared with the people you work with, and with nobody else.</p>

      <div class="actions">
        <a class="btn primary" href="/app">Sign in</a>
        <a class="btn secondary" href="${demoUrl}">See the demo</a>
      </div>

      <p class="muted">New here? The same button creates an account. You will be asked for the
      name of your parish straight afterwards.</p>

      <div class="note">
        <strong>Marking this project?</strong> The account details are in the submitted project
        README, not in the public repository. The first load after a quiet spell takes about a
        minute while the free host wakes up &mdash; it is not broken.
      </div>

      <footer>
        <p>The demo needs no sign-in and runs entirely in your browser on sample data.</p>
        <p><a href="${repoUrl}">Source on GitHub</a>, and the <a href="/healthz">server
        status</a> if something looks wrong.</p>
      </footer>
    </div>
  </section>
  <script src="/auth-forward.js"></script>
</main>`,
  });
}

/**
 * What a browser gets when a sign-in prompt is cancelled.
 *
 * Replaces `{"error":"Authentication required."}` on a blank white page, which
 * is correct for a program and reads as a crash to a person. The status is
 * still 401 and the `WWW-Authenticate` header is still on the response, so
 * "Sign in" below re-triggers the prompt.
 */
export function unauthorizedPage({ repoUrl = 'https://github.com/Damudachi/LiturgyGen' } = {}) {
  return shell({
    title: 'Sign in - LiturgyGen',
    description: 'This page is private and needs an account.',
    body: `<main class="card">
  <h1>LiturgyGen</h1>
  <p class="sub">This part of the app is private.</p>

  <hr class="rule">

  <p>Your parish&rsquo;s prayer library and its saved readings live behind this sign-in. If your
  session has expired, signing in again picks up where you left off &mdash; nothing is lost.</p>

  <div class="actions">
    <a class="btn primary" href="/app">Sign in</a>
    <a class="btn secondary" href="/">What is this?</a>
  </div>

  <div class="note">
    <strong>Marking this project?</strong> The account details are in the submitted project
    README. If they are not working, <a href="/readyz">/readyz</a> will tell you whether the
    server and its database are up.
  </div>

  <footer>
    <a href="${repoUrl}">Source on GitHub</a>, and the <a href="/healthz">server status</a>.
  </footer>
</main>`,
  });
}

export default { landingPage, unauthorizedPage, authForwardScript };
