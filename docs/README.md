# Project documents

Everything LiturgyGen is marked on that is not code, kept here in the
repository so it is versioned alongside the thing it describes.

Last checked against the code on **2026-10-09**.

| File | What it is |
| --- | --- |
| [01-proposal.md](01-proposal.md) | the revised proposal: purpose, audience, screens, state, risk |
| [02-mockup.md](02-mockup.md) | the screen map, wireframes at two widths, the phone shell, component tree |
| [03-design-system.md](03-design-system.md) | tokens, contrast, components, responsive and accessibility |
| [04-weekly-reports.md](04-weekly-reports.md) | a few lines a week, newest first |
| [05-demo-video.md](05-demo-video.md) | the recording, and its plan |
| [06-security-and-privacy.md](06-security-and-privacy.md) | what was checked before this went public, and what has changed since |
| [07-postgres-migration-map.md](07-postgres-migration-map.md) | every SQLite call site and what it became on PostgreSQL |

## Documents in the repository root

Three more live at the top of the repository rather than here, because they are
what somebody arriving at the project reads first:

| File | What it is |
| --- | --- |
| [`../README.md`](../README.md) | what LiturgyGen is, how to run it, how it is deployed |
| [`../AI-USAGE.md`](../AI-USAGE.md) | what was AI-written and what was not, with the failure cases |
| [`../SECURITY-CHECKLIST.md`](../SECURITY-CHECKLIST.md) | the rubric-shaped security table, with an evidence command per row |

`SECURITY-CHECKLIST.md` and `06-security-and-privacy.md` are the same audit
written twice: the root one is the table with the commands in it, this one is the
prose with the reasoning. **If one changes, check the other** — they have
disagreed before, and for eight days the prose one said `helmet` was not
installed while the table said it was.

## What is not here

`08-presentation-script.md` is deliberately **not in this repository**: it is the
spoken script, and it says my name out loud in the first line. It is git-ignored
and kept in the private coursework folder with the rest of the identifying
material. The demo video's Google Drive link is kept there too, for the same
reason — the video shows a face and says a name.

The full wireframe and design-system documents, with the rendered sheets, are
Word files kept outside this repository, because they carry a name and a student
number and this repository is public.

[`superpowers/specs/`](superpowers/) holds the written spec from the September
redesign. It is a record of what was decided and when, not a description of what
the app is now — it still names the chapel seal as the app's mark, which the
accounts work replaced. Read `02` and `03` for the current state.

## Images

Images are in [`assets/`](assets/). `assets/screenshot.png` is the one the main
README shows, and is a copy of `assets/calendar.png`.

> **`assets/phone.png` is out of date.** It was captured on 2026-09-27, which is
> before the signed-out entry spread and before the phone shell — so it shows
> neither the bottom tab bar nor the compact day tiles described in `02`. The
> desktop captures are still accurate. Re-shoot it at 375px wide before it is
> used for anything that is marked.

## Two things these documents are careful about

1. **Ticked boxes mean "true today", not "planned".** Where a row has changed
   its answer, the old answer is left in the row rather than deleted — what I
   believed, and when, is the point of keeping a checklist in version control
   at all.
2. **Counts live in one place.** Test counts belong in the newest weekly report
   and are referred to from everywhere else. A number copied into five documents
   is a number that will be wrong in four of them.
