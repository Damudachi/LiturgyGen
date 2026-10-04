/**
 * The two pages Express renders itself, rather than handing to React.
 *
 * WHY THESE ARE NOT REACT
 * -----------------------
 * Both are shown in situations where the React bundle is either not wanted or
 * not reachable:
 *
 *   landingPage()       is served at `/`, OUTSIDE the Basic Auth gate. Loading
 *                       a 220 KB bundle to show six lines of text to someone
 *                       who has not signed in yet is the wrong trade, and the
 *                       bundle lives behind the gate anyway.
 *   unauthorizedPage()  is what a browser gets when the sign-in prompt is
 *                       cancelled. By definition nothing behind the gate can be
 *                       fetched at that moment, so it cannot depend on a single
 *                       asset - no stylesheet, no font file, no script.
 *
 * So both are one self-contained document each, with their styles inline.
 *
 * CONTENT SECURITY POLICY
 * -----------------------
 * `src/app.js` sets `styleSrc: ["'self'", "'unsafe-inline'"]` but
 * `scriptSrc: ["'self'"]` with no `'unsafe-inline'`. An inline <style> block is
 * therefore allowed and an inline <script> is NOT - it would be silently
 * blocked, which is a miserable thing to debug. Everything here is markup and
 * CSS; the buttons are plain links, so neither page needs a line of JavaScript.
 *
 * COLOURS
 * -------
 * The "Vellum" palette from `client/src/index.css`, copied rather than imported
 * because that file is Tailwind source compiled into the client bundle and is
 * not readable from the server at run time. Only the handful of tokens these
 * pages use are repeated here. If the palette changes there, change it here -
 * there is no build step that will tell you.
 *
 * Light only, and `color-scheme: light` says so. The app itself has no dark
 * mode, and a dark landing page in front of a cream app looks like a mistake.
 */

/** Shared head, so the two pages cannot drift apart. */
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
    --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
    --sans: 'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif;
    --shadow-rest: 0 1px 2px rgba(27, 39, 64, 0.08), 0 3px 8px rgba(27, 39, 64, 0.09);
    --shadow-raise: 0 3px 6px rgba(27, 39, 64, 0.1), 0 12px 26px rgba(27, 39, 64, 0.16);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    /* 16px of gutter at phone width, and the card never touches the edge. */
    padding: 32px 16px;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .card {
    width: 100%;
    max-width: 30rem;
    padding: 2.5rem 2rem;
    background: var(--page);
    border: 1px solid var(--edge);
    border-radius: 10px;
    box-shadow: var(--shadow-rest);
    /* The gold edge of the chapel seal, as a single stripe rather than a logo. */
    border-top: 3px solid var(--gold);
  }

  @media (min-width: 30rem) {
    .card { padding: 3rem 2.75rem; }
  }

  h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--navy);
  }

  .sub {
    margin: 0.5rem 0 0;
    font-family: var(--serif);
    font-size: 1.0625rem;
    font-weight: 500;
    color: var(--muted);
  }

  .rule {
    height: 1px;
    margin: 1.75rem 0;
    background: var(--edge);
    border: 0;
  }

  p { margin: 0 0 1rem; }
  p:last-child { margin-bottom: 0; }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1.75rem 0 0;
  }

  a.btn {
    flex: 1 1 auto;
    min-width: 11rem;
    padding: 0.7rem 1.25rem;
    border-radius: 7px;
    font-family: var(--sans);
    font-size: 1rem;
    font-weight: 600;
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

  a.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-raise); }
  a.btn:active { transform: translateY(0); box-shadow: var(--shadow-rest); }

  /* Visible focus, because these are the only controls on the page. */
  a:focus-visible {
    outline: 2px solid var(--gold-edge);
    outline-offset: 2px;
  }

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

  footer {
    margin-top: 1.75rem;
    font-size: 0.875rem;
    color: var(--muted);
  }

  footer a { color: var(--navy); text-decoration-color: var(--edge); }
  footer a:hover { text-decoration-color: var(--gold-edge); }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    background: var(--page-hi);
    border: 1px solid var(--edge);
    border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    a.btn { transition: none; }
    a.btn:hover, a.btn:active { transform: none; }
  }
</style>
</head>
<body>
<main class="card">
${body}
</main>
</body>
</html>
`;
}

/**
 * The page at `/`, outside the gate.
 *
 * It says what the app is, who it is for, and that it needs an account - so
 * somebody following the link from the repository understands what they are
 * about to be asked for. It names no credential and reveals no data.
 *
 * Note what it no longer says. While the app was behind HTTP Basic Auth this
 * page warned that "your browser will ask for a username and password", because
 * the prompt was browser chrome arriving unannounced. There is no prompt any
 * more: sign-in is a screen inside the app, and the button below goes to it.
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
    body: `  <h1>LiturgyGen</h1>
  <p class="sub">Printable Mass missalettes for the Campus&nbsp;Ministry Office.</p>

  <hr class="rule">

  <p>Pick the days the office has a Mass and come away with a Word document per
  day &mdash; the liturgical day worked out from the Philippine calendar, the
  readings fetched from USCCB, and the right Prayers of the Faithful attached.</p>

  <p>Each parish runs its own copy of the library. You sign in with your own
  account, and your prayers, your house style and your Mass schedule belong to
  your parish &mdash; shared with the people you work with, and with nobody
  else.</p>

  <div class="actions">
    <a class="btn primary" href="/app">Sign in</a>
    <a class="btn secondary" href="${demoUrl}">See the demo</a>
  </div>

  <p style="margin-top:1.25rem">New here? The same button creates an account.
  You will be asked for the name of your parish straight afterwards.</p>

  <div class="note">
    <strong>Marking this project?</strong> The account details are in the
    submitted project README, not in the public repository. The first load after
    a quiet spell takes about a minute while the free host wakes up &mdash; it is
    not broken.
  </div>

  <footer>
    The demo needs no sign-in and runs entirely in your browser on sample data.
    &middot; <a href="${repoUrl}">Source on GitHub</a>
    &middot; <a href="/healthz">Status</a>
  </footer>`,
  });
}

/**
 * What a browser gets when the sign-in prompt is cancelled.
 *
 * Replaces `{"error":"Authentication required."}` on a blank white page, which
 * is correct for a program and reads as a crash to a person. The status is
 * still 401 and the `WWW-Authenticate` header is still on the response, so
 * "Sign in" below re-triggers the browser's prompt.
 */
export function unauthorizedPage({ repoUrl = 'https://github.com/Damudachi/LiturgyGen' } = {}) {
  return shell({
    title: 'Sign in - LiturgyGen',
    description: 'This page is private and needs a username and password.',
    body: `  <h1>LiturgyGen</h1>
  <p class="sub">This part of the app is private.</p>

  <hr class="rule">

  <p>Your parish&rsquo;s prayer library and its saved readings live behind this
  sign-in. If your session has expired, signing in again picks up where you left
  off &mdash; nothing is lost.</p>

  <div class="actions">
    <a class="btn primary" href="/app">Sign in</a>
    <a class="btn secondary" href="/">What is this?</a>
  </div>

  <div class="note">
    <strong>Marking this project?</strong> The account details are in the
    submitted project README. If they are not working, <a href="/readyz">/readyz</a>
    will tell you whether the server and its database are up.
  </div>

  <footer>
    <a href="${repoUrl}">Source on GitHub</a>
    &middot; <a href="/healthz">Status</a>
  </footer>`,
  });
}

export default { landingPage, unauthorizedPage };
