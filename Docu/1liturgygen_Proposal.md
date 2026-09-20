# **1. App Proposal**

Fill this in for your own idea. Write in full sentences where it asks - a proposal only you can decode next month does not help future-you either.

# **App name**

LiturgyGen

# **What the app is for, in one sentence**

A desktop application that automatically compiles Mass readings and formats Prayers of the Faithful based on the liturgical calendar, allowing the Campus Ministry office to easily generate and download a fully formatted `.docx` Missalette ready for printing.

# **Who is it for**

- Who, specifically, uses this app? The Campus Ministry office staff and student volunteers who are tasked with preparing the reading guides for upcoming campus Masses.

- What are they trying to get done in the moment they open it? They are trying to select a specific date (or batch of dates), instantly see the liturgical occasion, automatically fetch the exact readings from the USCCB, attach the appropriate Prayers of the Faithful, and download a `.docx` file laid out exactly like the office's printed missalette.

# **Sections or routes this app needs**

|**#**|**Section / route**|**What it is for**|
|---|---|---|
|1|Calendar|The main view displaying the month as tiles with liturgical colors. Users can click a day to open its "book" (Day View) or select several days to batch-generate missalettes.|
|2|Day View (Book)|Opens a specific day to show the liturgical steps on the left and a live `.docx` preview on the right. Users can fetch/paste readings and choose specific prayers here.|
|3|Prayers|A library to search, edit, and type in new Prayers of the Faithful templates from the General Intercessions books, which automatically cascade to match specific seasons, weeks, or occasions.|
|4|Settings|Allows configuration of font and page layout, which optional parts print, school-wide intentions, and fallback placeholder prayers.|

# **State: what data does the app hold?**

|**Data**|**Shape (rough)**|**Who owns it**<br>**(which component)**|**Changes when...**|
|---|---|---|---|
|*tab*|string ('calendar', 'prayers', 'settings')|App|user switches between the main navigation tabs|
|*cursor*|{ year, month }|CalendarScreen|user navigates to a previous or next month on the calendar|
|*selection*|array of date strings|CalendarScreen|user selects multiple days to batch process files|
|*daysByDate*|object mapping date strings to { title, color, rank }|CalendarScreen|the user changes the calendar month, triggering the Romcal library to calculate the days|
|*templates*|[{ id, season, text, type }]|App|staff adds, edits, or seeds a new prayer template into the SQLite database|
|*settings*|{ font, margins, schoolWideIntentions, etc. }|App|user updates preferences in the Settings panel|

# **What each screen contains**

- Screen: *Day View (Book)*
  - Block 1: The left side panel showing the date and Ordo occasion (e.g., "34th WEEK IN ORDINARY TIME - WEDNESDAY"), along with the steps (readings, psalm, gospel, prayers).
  - Block 2: The exact page layout preview on the right side, formatted exactly as it will print.
  - Block 3: Interactive controls to manually fetch readings, choose different POTF templates, or paste missing USCCB content.

- Screen: *Calendar*
  - Block 1: A grid of tiles for the current month, colored by liturgical season.
  - Block 2: A batch-making panel ("Select several days") that checks for missing elements (like psalm response) before generating the batch of `.docx` files.

# **Content you need to gather**

- The `romcal` JavaScript library configured with the Philippines calendar to handle complex liturgical calculations automatically.
- A starting set of placeholder Prayers of the Faithful to seed the SQLite database, or manual transcriptions from the office's copyrighted intercession books.
- The precise page geometries (margins, fonts, tab stops) from the office's sample document to accurately build the `.docx` files.

# **One risk**

Successfully scraping the USCCB website for readings, as they actively block scrapers with a proof-of-work challenge. The app needs to handle this by implementing a connection cooldown, relying on cached data when possible, and providing a fallback to Evangelizo (which lacks some responses) or manual pasting.

---

# Final project - proposal

Fill this in as your idea takes shape. It's a plan, not a contract - update it.

## The idea
*What are you building, in one or two sentences?*
I am building LiturgyGen, a desktop application that automates the creation of Campus Ministry Missalettes by calculating the liturgical day, fetching exact Mass readings from the USCCB, attaching matching Prayers of the Faithful, and generating a print-ready `.docx` file.

## Why
*What problem does it solve, or what do you want to learn?*
It solves the time-consuming manual process of checking the Ordo, copying readings from the web, typing up General Intercessions, and formatting Word documents for every school Mass. This project also serves as an opportunity to learn about integrating a React frontend with a Node.js/SQLite backend and packaging it as a standalone Windows desktop app using WebView2.

## Scope
*What's in for the first version? What's deliberately out?*
**In:**
- Romcal integration for the Philippine liturgical calendar.
- Scraping readings from USCCB with an Evangelizo fallback.
- SQLite database for managing and cascading Prayers of the Faithful templates.
- Generating properly formatted `.docx` files.
- Batch processing multiple days.

**Out:**
- Shipping the office's copyrighted intercession books directly in the public installer.
- Solving the USCCB proof-of-work bot challenge (we will use a cooldown and fallback instead).
- A web-hosted version (the app is strictly local/desktop).

## Milestones
- [ ] Set up the Express/SQLite backend and React client workspace.
- [ ] Integrate `romcal` for accurate Philippine calendar calculations.
- [ ] Build the USCCB scraper with caching and the Evangelizo fallback mechanism.
- [ ] Create the Prayers of the Faithful database and template cascading logic.
- [ ] Implement the `.docx` generation service with accurate margins and fonts.
- [ ] Build the calendar UI and batch processing panel.
- [ ] Package the app for Windows using Inno Setup and a WebView2 launcher.

## Open questions
*What are you unsure about?*
- How often will the USCCB change their DOM layout, breaking the scraper?
- Will the Evangelizo fallback be sufficient for days when the USCCB scraper gets temporarily blocked?
- Are the placeholder prayers sufficient for users who haven't yet transcribed their own physical books?
