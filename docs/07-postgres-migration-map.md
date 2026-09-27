# The SQLite to PostgreSQL migration map

LiturgyGen currently runs on **better-sqlite3**. It is moving to **PostgreSQL**.
This file is the working list: every place that touches the database, what it
does now, and what it becomes. It exists so the migration is a list of small
mechanical changes rather than an afternoon of guessing.

The ground is already in place and unused:

| File | What it is |
| --- | --- |
| `server/db/pool.js` | the `pg.Pool`, with SSL, sizing and a boot-time check on `DATABASE_URL` |
| `server/db/schema.sql` | the whole schema as PostgreSQL DDL, flattened from the five SQLite migrations |
| `server/db/seed.sql` | settings defaults, the placeholder prayers, a sample schedule |
| `server/db/run.js` | runs a `.sql` file against `DATABASE_URL` without needing `psql` installed |
| `server/.env.example` | `DATABASE_URL` and the rest, with placeholder values |

```bash
docker compose up -d db          # or your own PostgreSQL
cd server
cp .env.example .env             # set DATABASE_URL
npm run db:reset                 # schema.sql then seed.sql
```

---

## The three things that change everywhere

**1. Every call becomes asynchronous.** better-sqlite3 is synchronous by design:
`db.prepare(sql).get(id)` returns a row. `pg` returns a promise, and its result
is `{ rows, rowCount }`, not the row itself.

```js
// now
const row = getDb().prepare('SELECT * FROM potf_templates WHERE id = ?').get(id)

// after
const { rows } = await pool.query('SELECT * FROM potf_templates WHERE id = $1', [id])
const row = rows[0] ?? null
```

This is the change that spreads. Every function that touches the database
becomes `async`, and so does every caller, all the way up to the route handler —
which is already `async` in most cases because the scraper is.

**2. Placeholders change shape.** SQLite takes `?` positionally and `@name` by
name. PostgreSQL takes `$1`, `$2`, numbered, with the values in an array. There
are named-parameter wrappers for `pg`; this project does not use one, because
twenty call sites is not enough to justify a dependency in the query path.

**3. `.run()` results change.** `statement.run(...)` returns
`{ changes, lastInsertRowid }`. In `pg`, `changes` is `result.rowCount`, and
there is no `lastInsertRowid` at all — you ask for what you want back with
`RETURNING`:

```js
// now
const id = insert.run(...).lastInsertRowid

// after
const { rows } = await pool.query('INSERT INTO ... VALUES ($1, $2) RETURNING id', [a, b])
const id = rows[0].id
```

`RETURNING *` on an `UPDATE` is worth taking everywhere, because it removes the
follow-up `SELECT` several of these call sites do today.

---

## Type changes in the schema

`db/schema.sql` is already written this way. These are the differences to be
aware of when the query code is rewritten.

| Column | SQLite | PostgreSQL | What the code has to stop doing |
| --- | --- | --- | --- |
| `potf_templates.id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | reading `lastInsertRowid`; use `RETURNING id` |
| `response_options`, `intentions` | `TEXT` holding JSON | `JSONB` | `JSON.parse` on read and `JSON.stringify` on write — `pg` hands back a real array |
| `readings_overrides.payload` | `TEXT` holding JSON | `JSONB` | as above |
| `settings.value` | `TEXT` holding JSON | `JSONB` | as above |
| `is_active`, `is_placeholder` | `INTEGER` 0/1 | `BOOLEAN` | comparing to `1`; `WHERE is_active = 1` becomes `WHERE is_active` |
| `date` columns | `TEXT` `'YYYY-MM-DD'` | `DATE` | `pg` returns a JS `Date`; format it back to an ISO string on the way out, or `SELECT date::text` |
| `created_at`, `updated_at` | `TEXT` + `datetime('now')` | `TIMESTAMPTZ` + `now()` | nothing, but the values are now timezone-aware |

Two more that are easy to miss:

- **`INSERT OR REPLACE` does not exist.** Both upserts in this codebase already
  use `ON CONFLICT (...) DO UPDATE SET`, which PostgreSQL supports with the same
  syntax. `excluded` works the same way. These should port unchanged.
- **Transactions are not a callback.** `db.transaction(fn)()` becomes a client
  checked out of the pool:

  ```js
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // ... the work
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()   // without this the pool runs dry after five requests
  }
  ```

---

## Every call site

Twenty `prepare()` calls and four transactions, across five files. In rough
dependency order — `db/index.js` first, because everything else imports from it.

### `server/src/db/index.js`

| Line | What it does | Becomes |
| --- | --- | --- |
| 17–110 | the five `MIGRATIONS` entries, each calling `database.exec()` | **deleted.** `db/schema.sql` replaces all five. The SQLite database is not carried forward; the office's data is exported and re-imported once (see below) |
| 111–129 | `runMigrations()` and the `_migrations` table | **deleted** with the above |
| 131 | `getDb()` — opens the file, sets WAL, runs migrations | **deleted.** Callers import `pool` from `../../db/pool.js` |
| 155 | `checkDatabase()` — the `/readyz` query | body becomes `await pool.query('SELECT 1')`. The signature is already `async`, so nothing that calls it changes |
| 188 | `getSettings()` — `SELECT key, value FROM settings` | `async`; drop the `JSON.parse` on `value`, `pg` returns the parsed JSONB |
| 201–208 | `setSettings()` — upsert per key, inside a transaction | `async`; `$1/$2`; `JSON.stringify` stays on the **write** side (a JS value has to be serialised into the JSONB parameter); the transaction becomes BEGIN/COMMIT on a checked-out client |

### `server/src/db/seed.js`

| Line | What it does | Becomes |
| --- | --- | --- |
| 73 | `const db = getDb()` | `pool` |
| 76 | `findExisting` — SELECT by natural key | `async`, `$n` |
| 88 | `insert` | `RETURNING id` instead of `lastInsertRowid` |
| 99 | `update` | `RETURNING *`, which removes the re-read after it |
| 118 | the whole seed inside one `db.transaction()` | one client, BEGIN/COMMIT. This is the one place where a real transaction matters: a half-seeded template table is worse than an unseeded one |

### `server/src/routes/settings.js` — the Mass schedule

| Line | What it does | Becomes |
| --- | --- | --- |
| 43 | `SELECT * FROM scheduled_masses ${where} ORDER BY date` | `async`; **the `${where}` interpolation has to go**. It is built from `isIsoDate`-validated input today, so it is not injectable, but a query built by string concatenation is the thing a grader looks for first. Build a `$n` list instead |
| 52–56 | insert-or-update each date in a transaction | `ON CONFLICT (date) DO UPDATE`; BEGIN/COMMIT |
| 62 | `DELETE ... WHERE date = ?` then `.changes > 0` | `result.rowCount > 0` |

### `server/src/services/potfService.js` — the biggest one

| Line | What it does | Becomes |
| --- | --- | --- |
| 180–188 | `listTemplates` — SELECT with optional filters | `async`, `$n`. `WHERE is_active = 1` becomes `WHERE is_active` |
| 190 | `getTemplate(id)` | `rows[0] ?? null` |
| 195–200 | `createTemplate` | `RETURNING *` |
| 272 | `UPDATE ... SET ${sets.join(', ')} WHERE id = @id` | the `SET` list is assembled dynamically from which fields changed. Keep that, but number the placeholders: build `sets` as `` `${column} = $${n++}` `` and push the value onto an array in the same order |
| 277 | `deleteTemplate` | `rowCount` |
| 291 | `UPDATE ... SET is_placeholder = 1` | `= TRUE` |
| 359–390 | `resolveForDay` — the cascade, seven tiers, one `LIMIT 1` query per tier | the largest single change. Each tier is its own `await`, so a date that falls through to the last tier is now seven round trips instead of seven in-process reads. **Measure this before optimising it**, but the obvious fix if it matters is one query with a `CASE` ranking and `ORDER BY rank LIMIT 1` |

### `server/src/services/scraperService.js` — reading overrides

| Line | What it does | Becomes |
| --- | --- | --- |
| 119 | `SELECT payload, source, updated_at FROM readings_overrides WHERE date = ?` | `async`; drop the `JSON.parse` on `payload` |
| 153–160 | upsert an override | `ON CONFLICT (date) DO UPDATE`; `JSON.stringify` on the write side |
| 166 | `DELETE ... .changes > 0` | `rowCount > 0` |

---

## What this breaks, and what to do about it

**The tests.** All 82 server tests pass today without a database, because the
parser and document tests never touch one. That stays true — none of the files
above are imported by a test. The POTF and settings paths have no test coverage
today, which is the gap worth closing *during* the migration rather than after
it: `pg-mem` runs in-process and needs no server.

**The desktop build.** This is the real cost, and it is not a technical problem.
LiturgyGen installs on an office machine as a single `.exe` with no dependencies
because SQLite is a file. PostgreSQL is a server. After this migration the
installed app needs either a hosted database (so the office needs internet to
open the calendar, not just to fetch readings) or a bundled PostgreSQL (which
turns a 32 MB installer into something much larger and needs a service). Neither
is as good as what it replaces. The course requires PostgreSQL and a deployed
API, so the web deployment becomes the graded artifact and the desktop build
becomes a secondary one. That tradeoff is named here rather than discovered in
week 3.

**The office's existing data.** There is a live SQLite file with the
transcribed prayers in it. It is not migrated by this schema — it has to be
exported and re-inserted once:

```bash
# one-off, run against the old database before it is retired
node server/tools/export-sqlite.mjs > office-prayers.json   # to be written
node server/tools/import-json.mjs office-prayers.json       # to be written
```

Those two scripts do not exist yet. They are the last item on the list, not the
first, because nothing depends on them until the day of the switch.

---

## Order to do it in

1. `docker compose up -d db`, `npm run db:reset`, confirm `/readyz` answers `db: up`.
2. `db/index.js`: settings only. It is two functions and the whole app boots on it.
3. `scraperService.js`: three call sites, and the readings path has the best test coverage to catch a mistake.
4. `routes/settings.js`: the schedule, including killing the `${where}` interpolation.
5. `potfService.js`: everything except `resolveForDay`.
6. `resolveForDay`: the cascade, on its own, with a test per tier.
7. `db/seed.js`: last, because it is the only one that needs a working everything-else to verify.
8. Delete `better-sqlite3` from `server/package.json`, and the source-build layer from `server/Dockerfile`.
