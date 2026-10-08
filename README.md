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

1. **Search.** The backend queries Open Library and returns the closest match. Genre recommendations appear immediately while the AI works in the background.
2. **Read the DNA.** The backend sends the book's title, authors, and subjects to Claude (Haiku 5.5) and asks for real books in each of the four categories, with a reason for each.
3. **Validate.** Every suggested title is checked against Open Library in parallel. Anything that cannot be confirmed is dropped, so the app never shows a book that does not exist.
4. **Replace.** Validated results replace the genre fallback on screen.
5. **Cache.** The book's DNA is saved in SQLite, so the next search for the same book skips the AI call entirely.
6. **Personalize.** Each search is added to your session history. For You aggregates the DNA across your whole history and pools recommendations from every book you have searched.
7. **Survive outages.** Open Library search results and validated lookups are cached in SQLite for seven days. If Open Library is unavailable, cached results are served transparently. A book searched for the first time during an outage shows a friendly message ("The library's archives are unreachable at the moment") instead of a crash.

**Tradeoffs:** validating every suggestion adds latency, but it guarantees every recommendation is a real book. Caching DNA trades a little storage for speed and near-zero repeat cost. The genre fallback means the app degrades gracefully instead of breaking when the AI is unavailable.

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