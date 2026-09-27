# 6. Security and privacy checklist

Worked through on 2026-09-27, before the restructured repository was pushed.
Boxes are ticked only where the thing is actually true today.

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
- [ ] **Secret scanning and push protection are not on yet.** Both are free on
      public repositories. They go on at **Settings → Code security and
      analysis** the moment this repository is made public, which is the only
      point at which push protection can still prevent the problem rather than
      report it
- [ ] **A name is still in the history.** Commit `db5e93b` added
      `Docu/Sabando_Midterm Reflection Journal.pdf`. Removing a file does not
      remove it from the history, so a surname is reachable by anyone who walks
      the log. Nothing sensitive beyond the name is in it, and no credential was
      ever committed, so this is not urgent — but the fix is a history rewrite
      (`git filter-repo --path 'Docu/' --invert-paths`) followed by a force
      push, which rewrites every commit id and is not something to do casually.
      Decided, not forgotten. Open

## The application

- [x] **Parameterised queries.** Every SQLite call uses `?` or `@named` binding;
      no value is concatenated into SQL
- [x] **The one concatenated `WHERE` clause is gone.**
      `server/src/routes/settings.js` used to assemble its clause from an array
      of fragments. Always with bound values and behind `isIsoDate()`, so never
      injectable — but the wrong shape, and "it happens to be safe" is a worse
      property than "it cannot be unsafe". Replaced with four fixed query
      constants chosen by which bounds are present, so no SQL is built at run
      time at all
- [x] **A door in front of the app.** `server/src/middleware/basicAuth.js`,
      registered before every route in `src/app.js`. Off when
      `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` are unset, so development and the
      desktop build are unaffected; on when the host sets both. `/healthz` and
      `/readyz` stay outside it, because a platform health check cannot
      authenticate and a gated one gets the service killed. The middleware
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
- [ ] **`helmet` is not installed.** Its default Content-Security-Policy blocks
      the inline styles the built client uses, and I would rather add it with
      the policy set correctly than add it and disable the part that matters.
      Open, for week 3
- [ ] **No rate limiting.** Nothing here accepts a password or costs money, and
      the app is a local tool for one office, so this has been knowingly
      deferred. It becomes real the moment the API is on a public URL
- [x] No accounts and no passwords, so nothing to hash and nothing to leak
- [x] `npm audit` run on 2026-09-27: three moderate advisories in `qs`, reached
      through `body-parser` and `express`. `npm audit fix` cleared all three
      without a breaking change; `npm audit` now reports zero. Dependabot is on
      for both npm and Actions, grouped into one PR per ecosystem

## Privacy

- [x] **No real people.** LiturgyGen stores liturgical dates, scripture
      citations and prayer text. It collects nothing about anybody. There is no
      user table because there are no users to model
- [x] Seed data is invented. `server/db/seed.sql` and the demo seed hold
      placeholder prayers written for this tool and three invented Mass dates
- [x] No classmate's name, number, email or photo anywhere — not in seed data,
      not in the screenshots, and not in the demo video when it is recorded
- [x] The only face-like image is the chapel seal, which is the institution's
      own emblem
- [x] Nothing in the Philippine Data Privacy Act applies, because no personal
      information is collected

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

The riskiest thing in this project is not injection or credentials — there are
no accounts and no secrets beyond a connection string. It is that the app's
entire value comes from text somebody else owns: two published books of
intercessions and the New American Bible. A public repository that redistributed
either would be a real problem with my name permanently attached, and the first
draft of the demo seed generator would have done exactly that. What I did about
it: the books never enter version control, the scripture is fetched at runtime
and stripped out of anything committed, and the public installer ships without
the office's data. What I knowingly accepted: no rate limiting and no `helmet`,
because this is a single-office local tool today — both become real the day the
API sits on a public URL, which is week 3.
