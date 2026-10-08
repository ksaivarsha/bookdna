import sqlite3
import json
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "bookdna.db")


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dna_cache (
                book_id TEXT PRIMARY KEY,
                dna_json TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                book_id TEXT NOT NULL,
                book_title TEXT NOT NULL,
                book_authors TEXT NOT NULL,
                book_cover TEXT,
                searched_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_session "
            "ON search_history(session_id, searched_at)"
        )


def get_cached_dna(book_id: str) -> dict | None:
    with _db() as conn:
        row = conn.execute(
            "SELECT dna_json FROM dna_cache WHERE book_id = ?", (book_id,)
        ).fetchone()
        return json.loads(row["dna_json"]) if row else None


def save_dna(book_id: str, dna: dict):
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO dna_cache (book_id, dna_json) VALUES (?, ?)",
            (book_id, json.dumps(dna)),
        )


def add_to_history(
    session_id: str,
    book_id: str,
    book_title: str,
    book_authors: list,
    book_cover: str,
):
    with _db() as conn:
        last = conn.execute(
            "SELECT book_id FROM search_history "
            "WHERE session_id = ? ORDER BY searched_at DESC LIMIT 1",
            (session_id,),
        ).fetchone()
        if last and last["book_id"] == book_id:
            return
        conn.execute(
            "INSERT INTO search_history "
            "(session_id, book_id, book_title, book_authors, book_cover) "
            "VALUES (?, ?, ?, ?, ?)",
            (session_id, book_id, book_title, json.dumps(book_authors), book_cover or ""),
        )


def get_history(session_id: str, limit: int = 10) -> list:
    with _db() as conn:
        rows = conn.execute(
            "SELECT book_id, book_title, book_authors, book_cover "
            "FROM search_history WHERE session_id = ? "
            "ORDER BY searched_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        return [
            {
                "id": r["book_id"],
                "title": r["book_title"],
                "authors": json.loads(r["book_authors"]),
                "cover": r["book_cover"],
            }
            for r in rows
        ]
