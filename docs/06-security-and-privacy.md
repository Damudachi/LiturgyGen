# 6. Security and privacy checklist

Worked through on 2026-09-27, before the restructured repository was pushed,
and re-checked against the code on **2026-10-09**. Boxes are ticked only where
the thing is actually true today; where a row has changed its answer, the old
answer is left in the row rather than deleted, because *what I believed and
when* is the point of a checklist.

Two rows closed since the first pass — `helmet` and rate limiting — and one row
turned out to be wrong rather than stale: the count of commits carrying a
personal email address. Both kinds are marked below.

The longer, rubric-shaped version of this document is
[`SECURITY-CHECKLIST.md`](../SECURITY-CHECKLIST.md) in the repository root. This
file is the prose one; that one is the table with the evidence commands in it.

## Before the first push

- [x] `.gitignore` includes `.env`; `git check-ignore -v .env` confirms it, and
      the same rule covers `server/.env` and `client/.env`
- [x] `git ls-files | grep -iE '\.env$|\.pem$|id_rsa'` prints nothing
- [x] `.env.example` is committed in three places — root, `server/`, `client/` —
      with placeholder values only
- [x] No connection string, key or password anywhere in the repository,
      including in the screenshots in `docs/assets/`
- [x] No name, student number or email in the current tree. `Docu/` — the
      coursework folder, whose filenames carry a surname — is now git-ignored,
      and the two files from it that were tracked have been removed from the
      index. `LICENSE` carries a GitHub handle, not a name
- [x] **Future commits are anonymous.** `git config user.email` is set, for this
      repository only, to `Damudachi@users.noreply.github.com`. The global
      config is untouched, so other projects are unaffected
- [ ] **Secret scanning and push protection are not on.** This repository is
      already public, so both are available now at **Settings → Code security
      and analysis** and neither is enabled. Push protection cannot undo
      anything already pushed; it covers every commit from here. The history
      audit above is what says nothing has leaked so far — but an audit is a
      snapshot, not a control
- [ ] **A name is still in the history, and the count was wrong.** Commit
      `db5e93b` added a reflection journal PDF whose filename carried my
      surname. Removing a file does not remove it from the history, so the name
      is reachable by anyone who walks the log — and an author email is too.
      This row used to say "the eighteen commits made before 27 September" and
      "every commit since carries the noreply address". Counted again on
      2026-10-09, against 53 commits:
      `git log --pretty=%ae | sort | uniq -c` returns **25** carrying
      `sabando.ag@gmail.com` and 28 carrying
      `Damudachi@users.noreply.github.com`. Eighteen was never the number, and
      the cut-off is not clean: **seven of the 25 are dated 2026-10-04**, well
      after the switch. The repository-local setting is not the leak —
      `git config --local user.email` still reads the noreply address today.
      Those seven are the README and asset edits made through GitHub's web
      interface, which commits as the account's primary email and never sees a
      local git config. **So the rule is: an edit made in the browser
      re-attaches the address, every time.** Edit locally, or set the primary
      address on the GitHub account to the noreply one. Nothing sensitive
      beyond the name is in any of it and no credential was ever committed, so
      this is not urgent — but the fix is a history rewrite
      (`git filter-repo --path 'Docu/' --invert-paths --mailmap ...`) followed
      by a force push, which rewrites every commit id and is not something to
      do casually. Decided, not forgotten. Open

## The application

- [x] **Parameterised queries.** Every call passes values as numbered
      PostgreSQL placeholders - `$1`, `$2`, with the values in an array - and no
      value is concatenated into SQL. This row used to describe `?` and
      `@named` binding, which was true of the better-sqlite3 layer this
      replaced; the property is the same one, checked against the code that
      actually ships
- [x] **The one concatenated `WHERE` clause is gone.**
      `server/src/routes/settings.js` used to assemble its clause from an array
      of fragments. Always with bound values and behind `isIsoDate()`, so never
      injectable — but the wrong shape, and "it happens to be safe" is a worse
      property than "it cannot be unsafe". Replaced with four fixed query
      constants chosen by which bounds are present, so no SQL is built at run
      time at all
- [x] **A door in front of the app.** `server/src/middleware/requireAuth.js`,
      registered on `/api` in `src/app.js`. Supabase Auth issues the session;
      the middleware verifies the token and resolves `req.orgId` from the
      caller's membership rows, so the gate says **which** parish is asking and
      not merely whether the caller is allowed in. Off when `SUPABASE_URL` and
      `SUPABASE_SERVICE_ROLE_KEY` are unset, so development and the desktop
      build are unaffected; on when the host sets both. It replaced an HTTP
      Basic Authentication gate, retired to
      `src/middleware/retired/basicAuth.js`: one shared password cannot name a
      parish. It guards `/api` and only `/api` — above `express.static` a global
      gate served a signed-out browser JSON instead of the page that draws the
      sign-in form, so nobody could sign in. The built client is public because
      it holds no data: the same bundle for every parish. The landing page,
      `/healthz`, `/readyz` and `/auth-forward.js` stay outside, because a
      platform health check cannot sign in and a visitor following an email
      confirmation link has no session yet. The middleware
      **fails closed**: a credential check that throws produces a 401, never a
      pass-through
- [x] **Server-side validation.** Dates go through `isIsoDate()`, the settings
      route rejects unknown keys outright, and the POTF routes check lengths.
      The React form is for a fast, friendly message; the server is for
      correctness
- [x] `cors({ origin: allowedOrigins() })` names its origins from `CORS_ORIGINS`
      rather than `cors()` with no options, which would allow every site on the
      internet
- [x] `NODE_ENV=production` on a host, and no stack trace in any response body —
      `src/app.js` returns a plain message for a 5xx in production and logs the
      detail
- [x] **`helmet`, with a policy written to fit.** Installed in `src/app.js`.
      This row used to read "not installed", on the reasoning that helmet's
      default Content-Security-Policy blocks the inline styles the built client
      needs and that adding it with the wrong policy is worse than not adding
      it. The policy is now written out instead of switched off: `styleSrc`
      allows `'unsafe-inline'` because Tailwind injects a stylesheet at run
      time, `scriptSrc` does **not** — which is why the landing page's fragment
      forwarder is a file at `/auth-forward.js` rather than an inline block —
      and `connectSources()` derives `connect-src` from `SUPABASE_URL` instead
      of hardcoding it or leaving it open. `crossOriginEmbedderPolicy` is off:
      it buys nothing here and breaks the WebView2 desktop shell.
      `server/test/csp.test.js` exists because getting this wrong caused a real
      outage — the browser blocked every sign-in request before it left the
      page, `fetch` rejected with "Failed to fetch", and **nothing was logged
      anywhere**. A policy that is too tight fails silently in the browser with
      no server-side trace, so it gets a test
- [x] **Rate limiting.** `express-rate-limit` on `/api`, applied *after* the
      gate so a signed-in office is measured separately from anonymous traffic
      at the door. 600 requests a minute, which is generous on purpose: opening
      a month fires one calendar request plus one check per chosen day, and a
      200-day batch polls its own progress. It is a brake on abuse, not a quota.
      Disabled under `NODE_ENV=test` so the suite is not throttled. Sign-in
      attempts are rate-limited by Supabase, not here. This row used to read
      "knowingly deferred, because this is a local tool for one office" — true
      until the API went on a public URL, which is what made it real
- [x] **Passwords are not ours to leak.** This row used to read "no accounts and
      no passwords, so nothing to hash" — true until accounts shipped, and left
      here corrected rather than deleted. Supabase Auth holds the credentials
      and does the hashing; this application never sees a password, never stores
      one, and has no code path that could. What it holds is a bearer token for
      the length of a request. The service role key, which bypasses RLS, lives
      only in the host's settings panel — never in a `VITE_` variable, every one
      of which is compiled into a file the whole internet can download
- [x] `npm audit` run on 2026-09-27: three moderate advisories in `qs`, reached
      through `body-parser` and `express`. `npm audit fix` cleared all three
      without a breaking change; `npm audit` now reports zero. Dependabot is on
      for both npm and Actions, grouped into one PR per ecosystem. Two
      dependencies have been added since and are in that audit surface:
      `helmet` and `express-rate-limit`

## Privacy

- [x] **Almost no real people, and the exception is named.** LiturgyGen's own
      tables store liturgical dates, scripture citations and prayer text. This
      row used to end "there is no user table because there are no users to
      model", which stopped being true when accounts shipped: there is a
      `memberships` table now. What it holds is a `user_id` and a role — not a
      name, not an email. The address itself lives in Supabase Auth, never
      here. See the last row of this section
- [x] Seed data is invented. `server/db/seed.sql` and the demo seed hold
      placeholder prayers written for this tool and three invented Mass dates
- [x] No classmate's name, number, email or photo anywhere — not in seed data,
      not in the screenshots, and not in the demo video, which has now been
      recorded and watched back for exactly this
- [x] No face-like image in the application at all. The chapel seal was the
      only one and is no longer used; the mark is an inline SVG of an open book
- [x] **One category of personal information, named rather than denied.** This
      used to read "no personal information is collected", and that stopped
      being true the moment accounts shipped: Supabase Auth holds an **email
      address and a password hash** for each member of staff. That is personal
      information under the Philippine Data Privacy Act. What follows from it:
      the app itself never stores an email — `memberships` holds a `user_id`
      and a role, and the server reads the address from the token when it needs
      to show "signed in as". No name, no phone number, no address, nothing
      about a parishioner, and nothing about anybody who has not signed up.
      Deleting the Supabase user removes it. The prayers, dates and citations
      beside it are not personal data at all

## Copyright, which is the real risk here

Not on the standard checklist, but it is the thing most likely to go wrong in
this particular project.

- [x] **The General Intercessions volumes** (Fr. Albert Orillo, ST PAULS
      Philippines) are published, copyrighted books. The office's transcriptions
      live in `server/data/orillo/`, which is git-ignored, and the public
      installer is built without them. A fresh clone runs on placeholder prayers
      and says so
- [x] **The scripture text** is the New American Bible, copyright USCCB and the
      Confraternity of Christian Doctrine. It is fetched at runtime and cached
      on the user's own machine, never committed. The demo seed that *is*
      committed ships citations only: `server/tools/build-demo-seed.mjs`
      replaces every body of text with a stand-in line, and the check is a
      `grep` for a distinctive phrase
- [x] **The printed ORDO** is git-ignored along with the scans

## The one paragraph for the journal

The riskiest thing in this project is not injection or credentials. The secrets
are a connection string and a Supabase service role key, neither of which has
ever been committed, and the only personal information is a staff email address
and a password hash, both held by Supabase rather than by this application. It is that the app's
entire value comes from text somebody else owns: two published books of
intercessions and the New American Bible. A public repository that redistributed
either would be a real problem with my name permanently attached, and the first
draft of the demo seed generator would have done exactly that. What I did about
it: the books never enter version control, the scripture is fetched at runtime
and stripped out of anything committed, and the public installer ships without
the office's data. What I knowingly accepted at the time: no rate
limiting and no `helmet`, because this was a single-office local tool. The API
then went on a public URL, which is exactly the condition I had written down as
the thing that would make both real, and both are now in — the CSP with a test
behind it, because the way it fails is silent. What is still open is the author
email in the history, and the fact that an edit made through GitHub's web
interface puts it back.
