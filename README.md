# BookDNA

> Enter a title, an author, or a feeling — the library will find you a door.

BookDNA is a book recommendation web app with a Victorian manuscript aesthetic. Give it any book, and it surfaces six genre-matched recommendations drawn from the Open Library.

![BookDNA screenshot](docs/screenshot.png)

---

## Why I built this

<!-- TODO: Edit this section in your own words before publishing -->
I love reading — especially romantasy and fantasy — and I wanted book recommendations that feel personal rather than algorithmic. Every tool I tried felt like a spreadsheet. I wanted something that felt like stepping into a candlelit library where a very well-read librarian already knew what you were looking for. BookDNA is that librarian.

---

## Features

- **Book search** — search by title, author, or keyword; BookDNA queries the Open Library and returns the closest match
- **Genre-based recommendations** — each result comes with six books drawn from the same subject or genre as your query
- **Victorian aesthetic** — ornate SVG page borders, decorative friezes with fleur-de-lis motifs, and corner acanthus ornaments give the UI the feel of a printed manuscript
- **Atmospheric mist background** — layered warm-mist animations create a candlelit, parchment-and-ink feel
- **Cycling whisper phrases** — evocative literary phrases cycle beneath the logo to set the mood before you search

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6 |
| Backend | Python 3, FastAPI, uvicorn |
| Data source | [Open Library API](https://openlibrary.org/developers/api) — no key required |
| HTTP client | httpx (async) |
| Styling | Plain CSS with custom properties |

---

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 18+

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
uvicorn app.main:app --reload
```

The API starts at **http://localhost:8000**.  
The default `.env` values work for local development — no changes needed.

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

<!-- TODO: Edit, reorder, or replace these with your own ideas -->

1. **Genre mood selector** — let users pick a reading mood (romantasy, sci-fi, thriller, horror) and have the UI retheme itself with a cinematic transition; the theme system and transition infrastructure are already in the codebase, just not wired to the UI yet
2. **Richer book cards** — display description, page count, and star rating on each recommendation card; the Open Library data is already fetched, just not shown
3. **Reading list** — let users bookmark books to a personal list, persisted in `localStorage` or a lightweight backend store

---

## License

MIT
