# 5. Demo video

**Link:** not recorded yet. Due in week 3.

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
2. a browser on `liturgygen.onrender.com`, **already signed in**
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
| **0:55–2:15** | **4. Live demo** → **BROWSER** | Type the URL. Landing page, then the browser's own prompt — already signed in, so it appears once and no password is typed on camera. Calendar in liturgical colours → click 8 September → the day opens as a book, and the right-hand page **is** the document. Select several days: the batch flags three before making anything. Download one file. **Alt-tab back.** |
| 2:15–2:35 | **5. A month at a time** | Now the point of what they just saw: the check runs *before* anything is made, because a wrong missalette is not caught on screen — it is caught by a reader at an ambo holding a page with a blank line on it. |
| 2:35–2:55 | **6. The output** | Letter, those four margins, Book Antiqua, and the tab stop at 9630 twips that puts every citation flush right. "Almost right" is the version somebody notices during Mass. |
| 2:55–3:12 | **7. One origin, one gate** | Client and API on one origin — a decision, not a convenience: split apart, the browser cannot carry Basic Auth to the API and every request fails. Render, database on Neon. |
| 3:12–3:32 | **8. Five tables** | The schema, and why `readings_cache` is the one that matters. |
| **3:32–4:12** | **9. The code** → **EDITOR** | `potfService.js`, the cascade — **the part I wrote**. Seven tiers, most specific first, falling back to the Ordinary Time book for the same weekday; an order I got by watching the office work. Then `db/schema.sql` if the clock allows. **Alt-tab back.** |
| 4:12–4:32 | **10. Challenges** | Pick **one** and tell it properly. The date bug is the best: a DATE parsed as local midnight prints Tuesday's readings at Wednesday's Mass, and nobody debugging wrong readings suspects a date parser. |
| 4:32–4:44 | **11. Who wrote what** | Plainly: the liturgical logic and the parsers are mine, the PostgreSQL migration and the credential check were AI-written and disclosed in `AI-USAGE.md`. What I learned anyway was the ephemeral-filesystem trap. No apology, no dwelling. |
| 4:44–4:50 | **12. What is next** — back to face | Another parish clones it and runs its own copy. Thank you. |

## If it runs long

Cut in this order. Do not cut the demo or the code — those two are what the 60
points are for.

1. **Slide 3, What it does** — the demo shows it anyway
2. **Slide 7, One origin, one gate** — one sentence over the slide, then move
3. **`schema.sql`** in the code beat, keeping the cascade
4. **Slide 5, A month at a time** — fold its one line into the demo itself

## What to say about AI, on camera

One honest sentence at slide 11, then move on. It is disclosed in `AI-USAGE.md`
and the badge rewards an honest record over a tidy story. Do not oversell
authorship of code the git history can contradict.

## Checklist before recording

- [ ] **Warm the cache.** Run a batch over the demo dates *before* recording. A
      date never fetched costs a live USCCB request and up to three minutes of
      cooldown, on camera
- [ ] **Wake the service.** The free tier spins down after 15 idle minutes and
      takes about a minute to start. Load the page once before you hit record
- [ ] **Sign in before recording**, so the prompt appears on cue and the
      password is never typed on camera
- [ ] **Deck in Present mode, browser signed in, editor tabs open** — all three
      before the first frame
- [ ] **Real API, not demo mode** — record against `liturgygen.onrender.com`,
      never GitHub Pages, and the demo notice must not be on screen
- [ ] **Nothing secret in frame.** No `.env`, no terminal history, no Render
      environment panel, no Neon dashboard, no connection string
- [ ] The Prayers screen may show prayer **titles**; never scroll a prayer body
      into frame, because the books are copyrighted
- [ ] No real name other than mine anywhere on screen
- [ ] Recorded at 1440×900 so the two-page book layout fits
- [ ] **One throwaway take first.** The awkward alt-tab always shows up in the
      first two minutes
- [ ] Watch it back with sound before uploading
- [ ] Drive link set to **Anyone with the link can view**, checked in a private
      window — a link that cannot be opened is graded as a missing video
