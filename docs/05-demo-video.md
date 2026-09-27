# 5. Demo video

**Link:** not recorded yet. Due in week 3.

Three to five minutes, face and voice, as a public Google Drive link.

## Plan

| Time | What is on screen | What I say |
| --- | --- | --- |
| 0:00–0:30 | the office's printed missalette next to a blank Word document | The problem. One day of Mass: the ORDO, the USCCB site, the formatting, two volumes of intercessions. Twenty-plus repeats a month. |
| 0:30–1:15 | the Calendar; click 8 September | The month with its liturgical colours. Click a day and it opens as a book: what the day keeps on the left, the missalette exactly as it will print on the right. |
| 1:15–2:00 | "Select several days" → all weekdays → the making panel | A batch. Three days are flagged before anything is made — a missing psalm response, no prayers — and they are listed first, so they get fixed rather than printed wrong. |
| 2:00–2:45 | `services/potfService.js`, the cascade | The part I wrote. Seven tiers, most specific first, falling back to the Ordinary Time book for the same weekday — which is what the office does by hand. |
| 2:45–3:30 | `providers/usccbProvider.js` and `lib/httpQueue.js` | The bot challenge, the measured numbers, and why the answer was to keep the cookie and stop rather than to defeat the check. |
| 3:30–4:15 | `db/schema.sql`, then `/readyz` answering | PostgreSQL: the schema, the pool, and what moving off SQLite cost the desktop build. |
| 4:15–4:45 | the generated `.docx` open in Word, beside the office's original | The point of all of it: the same geometry, produced in a second. |

## Checklist before recording

- [ ] Real API, not demo mode — the demo notice must not be on screen
- [ ] No `.env` file, terminal history or connection string visible
- [ ] The Prayers screen may show prayer *titles*; never scroll a prayer body
      into frame, because the books are copyrighted
- [ ] No real name other than mine anywhere on screen
- [ ] Recorded at 1440×900 so the two-page book layout fits
