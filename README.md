# BookDNA

> Enter a title, an author, or a feeling, and the library will find you a door.

BookDNA is a book recommendation web app with a Victorian manuscript aesthetic. Give it any book and it surfaces categorized recommendations by storyline, tropes, world, and vibe, drawn from the Open Library and analyzed by an AI that reads each book's DNA.

![BookDNA recommendations by storyline and tropes](docs/screenshot.png)

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

- **Book search:** search by title, author, or keyword. BookDNA queries the Open Library and returns the closest match.
- **DNA-powered recommendations:** every result comes with four shelves: *Similar Storyline*, *Similar Tropes*, *Similar World/Setting*, and *Same Vibe*. Each book includes a one-line reason it was chosen.
- **Personalized For You shelf:** the homepage blends the DNA of everything you have searched (recurring tropes, settings, and subgenres) into recommendations made for your taste, excluding books you have already looked up.
- **Hallucination prevention:** every AI-suggested title is validated against Open Library before it appears. Books that cannot be confirmed are dropped.
- **SQLite caching:** each book's DNA is cached, so repeat searches are instant and cost nothing.
- **Outage resilience:** Open Library lookups are cached, so the app keeps working when Open Library is slow or down.
- **Anonymous sessions:** no account needed. Your search history is tied to a browser session ID stored in localStorage.
- **Genre fallback:** if no API key is configured, the app falls back to Open Library genre recommendations, so it always works.
- **Victorian aesthetic:** ornate SVG page borders, decorative friezes, and corner acanthus ornaments give the UI the feel of a printed manuscript, with layered warm-mist animations for a candlelit, parchment-and-ink atmosphere.

---

## How recommendations work

1. **Search.** The backend takes the top Open Library search match as the searched book. In parallel it fetches that book's description from the Open Library works endpoint (`/works/{id}.json`) and runs a second search on the book's first subject (or its first author, if it has no subjects) to get up to six genre recommendations. Those appear immediately and are added to your session history.
2. **Extract the DNA profile.** The frontend then sends the book to `/recommendations/by-category`. If the book has no stored profile, Claude (Haiku 5.5) reads its title, authors, publication year, subjects, and the first 2,000 characters of its description, and returns a structured profile (schema-constrained JSON): `tropes` (3 to 6), `world_setting`, `subgenre`, `tone`, and `storyline_summary`. The profile is saved in the SQLite `book_profile` table, keyed by Open Library work ID.
3. **Recommend from the DNA.** A second Claude call gets the book details, the first 400 characters of the description, and the full profile. It returns six books for each of four shelves, each tied to one part of the profile: *Similar Storyline* (storyline), *Similar Tropes* (tropes), *Similar World/Setting* (setting and subgenre), and *Same Vibe* (tone). Each book comes with a one-line reason. The result is cached in `dna_cache`. Cached recommendations are reused only if the book already had a profile, so recommendations made before profiles existed are regenerated once.
4. **Validate.** Every suggestion is looked up on Open Library by title and author, in parallel. A suggestion is dropped if nothing matches, or if fewer than half of the significant words in its title (longer than two letters) appear in the matched title. Each shelf keeps up to six books.
5. **Show the DNA.** The searched book's tropes appear as chips under its title, along with its setting and tone. The validated shelves replace the genre recommendations.
6. **Personalize (For You).** The homepage loads the stored profiles for the last five books in your session history. If none of them has a profile, one is extracted for the most recent book from its title and authors alone. Across those profiles, the backend counts tropes (each book counts a trope once) and keeps the top six. It does the same for world settings and subgenres, keeping the top three of each. Counting uses exact matches after lowercasing and removing punctuation, so "Fae courts" and "fae courts" count together but differently worded settings do not. Claude gets this taste profile with its counts (for example "enemies to lovers (2 of 2 books)"), plus the titles you have already searched, and returns three shelves ordered best match first: *Tropes You Return To*, *Worlds You Wander*, and *Your Subgenres*. The result is cached in `taste_cache` under a hash of the taste profile and searched titles, so Claude is only called again when your taste changes. The suggestions go through the same validation step. Books you have already searched (your last 50 searches) are removed, and so are books that appeared on an earlier shelf.
7. **Survive outages.** Open Library search results and work descriptions are cached in SQLite for seven days. Each request has an 8-second timeout and one retry. If a description cannot be fetched, the book is profiled without it. A book searched for the first time during an outage shows a friendly message ("The library's archives are unreachable at the moment") instead of a crash.
8. **Log failures safely.** Claude and Open Library failures are logged with the exception type, stop reason, or HTTP status only. Error messages and request details are never logged, so the API key cannot appear in the logs.

**Without an API key:** no profiles are created and no AI shelves appear. The search page shows only the genre recommendations, and For You stays hidden.

**Tradeoffs:** extracting a profile first adds one extra Claude call the first time a book is searched, but it makes each shelf target a specific part of the book's DNA and gives For You something concrete to count. Validating every suggestion adds latency, but it guarantees every recommendation is a real book. Caching profiles, recommendations, and taste shelves trades a little storage for speed and near-zero repeat cost.

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

1. **Book detail pages and a literary fingerprint card:** click any recommendation to read its full description and reason, and see the searched book's DNA (tropes, setting, tone) displayed as a fingerprint.
2. **Reading list:** bookmark books to a personal list. The session infrastructure is already in place.
3. **Genre mood selector:** pick a reading mood (romantasy, sci-fi, thriller, horror) and have the UI retheme itself with a cinematic transition. The theme system and transition infrastructure are already in the codebase.

---

## License

MIT