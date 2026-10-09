# 5. Demo video

> **Status: recorded, and it is too long.**
>
> | | |
> | --- | --- |
> | Recorded | 2026-10-04 |
> | Runtime | **6:13** (373.4s) |
> | Allowed | 3:00–5:00 |
> | Over by | **1:13** |
> | Link | a public Google Drive link, kept in the private coursework folder — not in this repository, because the video shows a face and says a name |
>
> The cue sheet below targets **4:50**. The recording came in **1:23 over that
> target** and 1:13 over the hard maximum, so every beat ran long rather than
> one beat running away: 1:23 spread across twelve slides is about seven seconds
> each. That is the shape of reading a slide aloud instead of talking over it,
> which is the one thing the cue sheet says not to do.
>
> **Treat this as a real overrun, not a cosmetic one.** A stated maximum is a
> requirement, and how it is enforced is not written down anywhere I can check —
> it may cost marks, or it may mean a marker stops watching at 5:00. If it is
> the second, what goes unwatched is the last two slides, and one of those is
> *Who wrote what*, the AI disclosure. That is the worst possible thing to lose,
> so the fix is a re-record against the cut list under **If it runs long**,
> not a trim at the end. **Confirm the actual penalty with the course
> announcement before deciding how much work to put into the re-record.**
>
> The duration is measurable from the file itself:
> `mvhd` version 0, timescale 1000, duration 373353. An earlier attempt to read
> this reported `timescale=0` and was written up as a corrupt file; the atom was
> fine and the offset in the parse was wrong.

Three to five minutes, face and voice, as a public Google Drive link. The rubric
gives 60 of the presentation's 100 points to this, for walking through the app
**and the code** and explaining the choices — not for production polish.

## How this works

**The deck runs for the whole video.** Every slide is on camera. Two of them are
not content at all — they are switch cues:

| Slide | What it is |
| --- | --- |
| 4. **Live demo** | Stop. Alt-tab to the browser. Come back when done. |
| 9. **The code** | Stop. Alt-tab to the editor. Come back when done. |

Both carry a fallback on the slide itself: slide 4 holds the day-book
screenshot, so if the live site misbehaves you stay on the slide and talk over
the picture instead of fighting a browser on camera.

Have three things open before you start recording, and switch with alt-tab:

1. the deck in Present mode, or the exported PDF full screen
2. a browser on `liturgygen.onrender.com`, **already signed in**, with the
   landing page at `/` as the first thing on screen
3. the editor, with `potfService.js` and `db/schema.sql` already open as tabs

## Cue sheet

Target 4:50. The **Time** column is cumulative, so if a beat runs long the next
absorbs it. Twenty seconds is one good sentence and a pause — not three bullets
read aloud. The deck's speaker notes are written to that length.

| Time | Slide | What I say |
| --- | --- | --- |
| 0:00–0:12 | **1. Cover** — face on camera | Who I am and what this is, in one sentence. Do not read the slide. |
| 0:12–0:37 | **2. The problem** | Four sources per day, twenty-plus times a month, and none of it is a judgement call. That last card is the argument for the whole project. |
| 0:37–0:55 | **3. What it does** | The four steps, quickly, so I do not have to narrate the obvious while clicking. |
| **0:55–2:15** | **4. Live demo** → **BROWSER** | Type the URL. The landing page says what it is; press **Sign in** — already signed in, so the app opens straight away and no password is typed on camera. Calendar in liturgical colours → click 8 September → the day opens as a book, and the right-hand page **is** the document. Select several days: the batch flags three before making anything. Download one file. **Alt-tab back.** |
| 2:15–2:35 | **5. A month at a time** | Now the point of what they just saw: the check runs *before* anything is made, because a wrong missalette is not caught on screen — it is caught by a reader at an ambo holding a page with a blank line on it. |
| 2:35–2:55 | **6. The output** | Letter, those four margins, Book Antiqua, and the tab stop at 9630 twips that puts every citation flush right. "Almost right" is the version somebody notices during Mass. |
| 2:55–3:12 | **7. One origin, one gate** | Supabase issues the session; the server verifies the token and resolves which parish is asking. The gate guards `/api` and **only** `/api` — above `express.static` it served a signed-out browser a JSON error instead of the page that draws the sign-in form, so nobody could ever sign in. Render, database on Supabase. |
| 3:12–3:32 | **8. Seven tables** | Every parish-owned table carries an `org_id` and every query names it. Then the exception: `readings_cache` does not, because 8 September's readings are the same in every parish and a miss costs three minutes of cooldown. |
| **3:32–4:12** | **9. The code** → **EDITOR** | `potfService.js`, the cascade — **the part I wrote**. Seven tiers, most specific first, falling back to the Ordinary Time book for the same weekday; an order I got by watching the office work. Then `db/schema.sql` if the clock allows. **Alt-tab back.** |
| 4:12–4:32 | **10. Challenges** | Pick **one** and tell it properly. The date bug is the best: a DATE parsed as local midnight prints Tuesday's readings at Wednesday's Mass, and nobody debugging wrong readings suspects a date parser. |
| 4:32–4:44 | **11. Who wrote what** | Plainly: the liturgical logic and the parsers are mine, the PostgreSQL migration and the retired Basic Auth credential check were AI-written and disclosed in `AI-USAGE.md`. What I learned anyway was the ephemeral-filesystem trap. No apology, no dwelling. |
| 4:44–4:50 | **12. What is next** — back to face | A parish can sign up and found its own library; letting a colleague *into* one is the gap that is left. Thank you. |

## If it runs long

Cut in this order. Do not cut the demo or the code — those two are what the 60
points are for.

1. **Slide 3, What it does** — the demo shows it anyway
2. **Slide 7, One origin, one gate** — one sentence over the slide, then move
3. **`schema.sql`** in the code beat, keeping the cascade
4. **Slide 5, A month at a time** — fold its one line into the demo itself

### Sized against the 6:13 take

The four cuts above are worth roughly 0:18 + 0:17 + 0:10 + 0:20 = **1:05**
against the cue sheet's own allocations. The take is 1:13 over the maximum, so
**the cut list alone does not get there** — it was written to absorb a beat that
ran long, not a take that ran long everywhere.

What actually closes the gap, in order of how much it buys for how little it
costs:

1. **Make all four cuts.** About 1:05.
2. **Stop reading the slides.** The overrun is distributed, so this is where the
   rest is. A slide is the visual; the sentence is spoken over it, once.
3. **Do not re-narrate the demo.** Slides 3 and 5 exist to be folded into the
   clicking, which is cut 1 and cut 4 above.

Keep intact, whatever else goes: the live demo (slide 4), the code walk-through
of the POTF cascade (slide 9), and slide 11. The first two are what 60 of the
100 points are for, and the third is the AI disclosure, which is not optional.

## What to say about AI, on camera

One honest sentence at slide 11, then move on. It is disclosed in `AI-USAGE.md`
and the badge rewards an honest record over a tidy story. Do not oversell
authorship of code the git history can contradict.

## Checklist before recording

The boxes are **deliberately left unticked**. This is the list to work down
before a take, and the take that exists was made against it — but which rows
were actually confirmed on the day was not recorded at the time, and ticking
them now would be writing down something I do not know. It stands as the list
for the re-record.

- [ ] **Warm the cache.** Run a batch over the demo dates *before* recording. A
      date never fetched costs a live USCCB request and up to three minutes of
      cooldown, on camera
- [ ] **Wake the service.** The free tier spins down after 15 idle minutes and
      takes about a minute to start. Load the page once before you hit record
- [ ] **Sign in before recording.** Sign-in is a screen inside the app now,
      not the browser's password box, so a live session means pressing **Sign
      in** opens the calendar and no password is typed on camera
- [ ] **Deck in Present mode, browser signed in, editor tabs open** — all three
      before the first frame
- [ ] **Real API, not demo mode** — record against `liturgygen.onrender.com`,
      never GitHub Pages, and the demo notice must not be on screen
- [ ] **Seed the prayers first.** A parish founded on the host gets the
      placeholder set only — `server/data/orillo` is git-ignored, so Render has
      never had it. From a machine that does have it, with `DATABASE_URL`
      pointing at the host: `cd server && npm run seed -- --org <uuid>`. Check
      the Prayers screen shows the real titles before recording
- [ ] **Do not open the prayer-book importer on camera.** It is written but has
      not been run against a real book. The Prayers screen's **Import a prayer
      book** button is the one thing in the app that has not been walked
      through; mention it on slide 12 if at all, do not demonstrate it
- [ ] **Nothing secret in frame.** No `.env`, no terminal history, no Render
      environment panel, no Supabase dashboard, no connection string, and never
      the service role key
- [ ] The Prayers screen may show prayer **titles**; never scroll a prayer body
      into frame, because the books are copyrighted
- [ ] No real name other than mine anywhere on screen
- [ ] Recorded at 1440×900 so the two-page book layout fits
- [ ] **One throwaway take first.** The awkward alt-tab always shows up in the
      first two minutes
- [ ] Watch it back with sound before uploading
- [ ] Drive link set to **Anyone with the link can view**, checked in a private
      window — a link that cannot be opened is graded as a missing video
