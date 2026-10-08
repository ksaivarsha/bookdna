import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.db import add_to_history, get_history, get_cached_dna, save_dna
from app.services.dna import get_categorized_candidates
from app.routes.recommendations import CATEGORY_LABELS, validate_category

router = APIRouter()


def _norm(s: str) -> str:
    return "".join(c.lower() for c in s if c.isalnum() or c.isspace()).strip()


def _dedup(candidates: list) -> list:
    seen, out = set(), []
    for c in candidates:
        key = _norm(c.get("title", ""))
        if key and key not in seen:
            seen.add(key)
            out.append(c)
    return out


class HistoryEntry(BaseModel):
    session_id: str
    book_id: str
    book_title: str
    book_authors: list[str]
    book_cover: Optional[str] = ""


@router.post("/add")
async def add_history_entry(entry: HistoryEntry):
    add_to_history(
        entry.session_id,
        entry.book_id,
        entry.book_title,
        entry.book_authors,
        entry.book_cover or "",
    )
    return {"ok": True}


@router.get("/{session_id}")
async def get_session_history(session_id: str):
    return {"books": get_history(session_id, limit=10)}


@router.get("/{session_id}/for-you")
async def for_you(session_id: str):
    """
    Aggregate book DNA across the full session history (up to 5 books)
    and return blended category recommendations.
    Falls back to generating DNA for the most recent book if none are cached.
    """
    recent = get_history(session_id, limit=5)
    if not recent:
        return {"books": [], "categories": [], "fallback": False}

    # Collect cached DNA for all recent books
    candidate_pools = {label: [] for label in CATEGORY_LABELS}
    books_with_dna = []

    for entry in recent:
        cached = get_cached_dna(entry["id"]) if entry["id"] else None
        if cached:
            books_with_dna.append(entry)
            for label in CATEGORY_LABELS:
                candidate_pools[label].extend(cached.get(label, []))

    # If no cached DNA at all, generate for the most recent book on-demand
    if not books_with_dna:
        source = recent[0]
        book_stub = {
            "id": source["id"],
            "title": source["title"],
            "authors": source["authors"],
            "description": "",
            "categories": [],
        }
        raw = await get_categorized_candidates(book_stub)
        if raw and source["id"]:
            save_dna(source["id"], raw)
        if not raw:
            return {"books": [source], "categories": [], "fallback": True}
        books_with_dna = [source]
        for label in CATEGORY_LABELS:
            candidate_pools[label].extend(raw.get(label, []))

    # Deduplicate pooled candidates across all source books, cap at 8 per category
    deduped = {label: _dedup(pool)[:8] for label, pool in candidate_pools.items()}

    # Validate all categories in parallel
    validated = await asyncio.gather(
        *[validate_category(deduped[label]) for label in CATEGORY_LABELS]
    )

    categories = [
        {"label": label, "books": books}
        for label, books in zip(CATEGORY_LABELS, validated)
        if books
    ]

    return {
        "books": books_with_dna,   # all contributing books (1–5)
        "categories": categories,
        "fallback": False,
    }
