# BookDNA

> Enter a title, an author, or a feeling, and the library will find you a door.

BookDNA is a book recommendation web app with a Victorian manuscript aesthetic. Give it any book and it surfaces categorized recommendations by storyline, tropes, world, and vibe, drawn from the Open Library and analyzed by an AI that reads each book's DNA.

![BookDNA For You shelves built from your recurring tropes and worlds](docs/screenshot.png)

### The library
![BookDNA homepage](docs/home.png)

### For You: personalized from your search history
![For You recommendations](docs/for-you.png)

### Recommendations by world and setting
![World and setting recommendations](docs/categories.png)

---

## Why I built this

I love reading, especially romantasy and fantasy, and I wanted book recommendations that feel personal rather than algorithmic. Every tool I tried felt like a spreadsheet. I wanted something that felt like stepping into a candlelit library where a very well-read librarian already knew what you were looking for. BookDNA is that librarian.

---

## Features

- **Book search:** search by title, author, or keyword. BookDNA queries the Open Library and shows the closest match as a featured card with its cover, author, year, description, and DNA.
- **Book DNA:** each searched book gets a profile of its tropes, world/setting, subgenre, tone, and storyline. The tropes show as chips on the featured card, along with the setting and tone.
- **DNA-powered recommendations:** every result comes with four shelves: *Similar Storyline*, *Similar Tropes*, *Similar World/Setting*, and *Same Vibe*. Each book includes a one-line reason it was chosen.
- **Progressive loading:** the featured book appears in about a second. The DNA follows a couple of seconds later, then each shelf appears as soon as it is ready instead of waiting for all four.
- **Book detail panels:** click any recommended book to open a manuscript-style panel with its full reason and its Open Library description. From there you can search for it ("Seek this book") or open it on Open Library. The panel closes with the X, the Escape key, or a click outside, and works from the keyboard.
- **Personalized For You shelf:** the homepage blends the DNA of your recent searches (recurring tropes, settings, and subgenres) into recommendations made for your taste, excluding books you have already looked up.
- **Shareable searches:** every search lives in the URL (`?q=...`), so the back button works and a search can be shared as a link. The BOOKDNA wordmark and "Return to the library" bring you back to the homepage.
- **Hallucination prevention:** every AI-suggested title is validated against Open Library before it appears. Books that cannot be confirmed are dropped.
- **SQLite caching:** each book's DNA and shelves are cached, so repeat searches skip the AI entirely.
- **Outage resilience:** Open Library lookups are cached, so the app keeps working when Open Library is slow or down.
- **Anonymous sessions:** no account needed. Your search history is tied to a browser session ID stored in localStorage.
- **Genre fallback:** genre picks from Open Library show while the AI works and stay on screen if it is unavailable (or no API key is configured), so the page is never empty.
- **Victorian aesthetic:** ornate SVG page borders, decorative friezes, and corner acanthus ornaments give the UI the feel of a printed manuscript, with layered warm-mist animations for a candlelit, parchment-and-ink atmosphere.

---

## How recommendations work

1. **Search.** `/books/search` takes the top Open Library search match, then fetches its description from the works endpoint (`/works/{id}.json`). Markdown links and trailing source notes are stripped from the description. The frontend shows the book right away as the featured card and adds it to your session history. It then makes two requests in parallel: `/books/related` for genre picks, and `/recommendations/by-category` for the AI shelves. The genre picks come from an Open Library search on the book's first subject, or its first author if it has no subjects, and appear while the AI shelves load.
2. **Extract the DNA profile.** `/recommendations/by-category` streams its results as newline-delimited JSON events. If the book has no stored profile, Claude (Haiku 5.5) reads its title, authors, publication year, subjects, and the first 2,000 characters of its description. It returns a structured profile (schema-constrained JSON): `tropes` (3 to 6), `world_setting`, `subgenre`, `tone`, and `storyline_summary`. This call runs with thinking turned off. The profile is saved in the SQLite `book_profile` table, keyed by Open Library work ID, and sent to the page as a `profile` event, which fills in the DNA on the featured card.
3. **Recommend from the DNA.** A second Claude call, with adaptive thinking on, gets the book details, the first 400 characters of the description, and the full profile. It returns six books for each of four shelves, each tied to one part of the profile: *Similar Storyline* (storyline), *Similar Tropes* (tropes), *Similar World/Setting* (setting and subgenre), and *Same Vibe* (tone). Each book comes with a one-line reason. The response is streamed as schema-constrained JSON, and the backend parses it as it arrives. A shelf is handed off as soon as the next shelf has started. Once all four shelves have arrived, the result is cached in `dna_cache`. Cached recommendations are reused only if the book already had a profile, so recommendations made before profiles existed are regenerated once.
4. **Validate, shelf by shelf.** Each shelf is validated as soon as it is handed off, while Claude is still writing the later ones. Every suggestion is looked up on Open Library by title and author, with a 3-second timeout and one retry. A suggestion is dropped if nothing matches, or if fewer than half of the significant words in its title (longer than two letters) appear in the matched title. Each shelf keeps up to six books and is sent to the page as a `shelf` event the moment it is validated. For a cached book, all four shelves are validated in parallel and sent as each one finishes. A final `done` event closes the stream.
5. **Show it.** The first shelf to arrive replaces the genre picks, and the rest appear in the order of the four shelves. If the stream fails or no shelf survives, the genre picks stay on screen.
6. **Personalize (For You).** The homepage loads the stored profiles for the last five books in your session history. If none of them has a profile, one is extracted for the most recent book from its title and authors alone. Across those profiles, the backend counts tropes (each book counts a trope once) and keeps the top six. It does the same for world settings and subgenres, keeping the top three of each. Counting uses exact matches after lowercasing and removing punctuation, so "Fae courts" and "fae courts" count together but differently worded settings do not. Claude gets this taste profile with its counts (for example "enemies to lovers (2 of 2 books)"), plus the titles you have already searched. It returns three shelves ordered best match first: *Tropes You Return To*, *Worlds You Wander*, and *Your Subgenres*. The result is cached in `taste_cache` under a hash of the taste profile and searched titles, so Claude is only called again when your taste changes. The suggestions go through the same validation step. Books you have already searched (your last 50 searches) are removed, and so are books that appeared on an earlier shelf.
7. **Details on demand.** Clicking a recommended book opens its detail panel, which fetches the description through `/books/work` (the same cached works lookup).
8. **Survive outages.** Open Library search results and work descriptions are cached in SQLite for seven days. Searches and description fetches have an 8-second timeout and one retry. If a description cannot be fetched, the book is profiled without it. A book searched for the first time during an outage shows a friendly message ("The library's archives are unreachable at the moment") instead of a crash.
9. **Log safely.** Each search logs how long every stage took (`timing stage=... ms=...`) and how many tokens each Claude call used. Claude and Open Library failures are logged with the exception type, stop reason, or HTTP status only. Error messages and request details are never logged, so the API key cannot appear in the logs.

**Without an API key:** no profiles are created and no AI shelves appear. The search page shows the featured book and the genre picks, and For You stays hidden.

**Tradeoffs:** extracting a profile first adds one extra Claude call the first time a book is searched, but it makes each shelf target a specific part of the book's DNA and gives For You something concrete to count. Validating every suggestion adds latency, but it guarantees every recommendation is a real book. Caching profiles, recommendations, and taste shelves trades a little storage for speed and near-zero repeat cost.

---

## Speed

Timings come from the stage logs, measured on three first-time searches (*The Night Circus*, *Circe*, *Mexican Gothic*) with empty caches. Times are measured from pressing Seek.

| | Before | After |
|---|---|---|
| Searched book on screen | 1.4–2.8 s (waited on the genre search) | 0.5–1.4 s |
| DNA chips | with the shelves, 26–30 s | 3–4 s |
| First shelf | 26–30 s (all four at once) | 7–14 s |
| Last shelf | 26–30 s | 13–18 s |
| Validation pass rate | 70/72 (97%) | 70/72 (97%) |

What made the difference:

- **Show the book first.** The genre search no longer blocks `/books/search`, so the featured card renders as soon as the match and description are in.
- **Stream and pipeline the shelves.** Recommendations stream in, and each shelf is validated while Claude writes the next one. Before, all 24 suggestions were validated at once after the whole response had arrived, which took about 5 seconds. Each shelf now validates in about half a second.
- **Thinking off where it doesn't help.** The profile is short and structured, and with thinking off its quality matched the thinking-on version in testing. Thinking stays on for recommendations: with it off, 86% of suggestions passed validation instead of 96–97%.
- **Two calls, not one.** Merging the profile and shelves into one call was tested. With thinking on, the DNA chips waited 8–14 seconds behind the model's thinking, and with thinking off, quality dropped. Keeping the fast profile call separate puts the DNA on screen within a few seconds.
- **A short validation timeout.** Open Library validation lookups time out after 3 seconds (8 seconds elsewhere), so one slow response cannot hold a shelf back for long. During an Open Library slowdown, this can drop a real book that would otherwise have been confirmed.

Cost per first-time search is about the same: roughly 2,000–2,500 input and 1,800–4,000 output tokens, mostly the recommendation call's thinking. On Haiku 5.5 that is about $0.002. Repeat searches use the cache and cost nothing.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6 |
| Backend | Python 3, FastAPI, uvicorn |
| AI | Anthropic API (Claude Haiku 5.5) |
| Data source | [Open Library API](https://openlibrary.org/developers/api), no key required |
| HTTP client | httpx (async) |
| Cache and history | SQLite |
| Styling | Plain CSS with custom properties |

---

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key (optional: without one, the app uses the genre fallback)

### 1. Clone

```bash
git clone https://github.com/ksaivarsha/bookdna.git
cd bookdna
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (leave it blank to use the genre fallback)
uvicorn app.main:app --reload
```

The API starts at **http://localhost:8000**.

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app opens at **http://localhost:5173**.

---

## What I'd build next

1. **Normalized settings:** have Claude pick each book's world setting from a fixed list instead of writing free text, so For You can count settings across books the way it already counts tropes and subgenres.
2. **Reading list:** bookmark books to a personal list. The session infrastructure is already in place.

---

## License

MIT