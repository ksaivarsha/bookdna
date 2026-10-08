import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.db import add_to_history, get_history, get_cached_dna, save_dna
from app.services.dna import get_categorized_candidates
from app.routes.recommendations import CATEGORY_LABELS, validate_category

router = APIRouter()


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
    recent = get_history(session_id, limit=1)
    if not recent:
        return {"book": None, "categories": [], "fallback": False}

    source = recent[0]
    book = {
        "id": source["id"],
        "title": source["title"],
        "authors": source["authors"],
        "description": "",
        "categories": [],
    }

    cached = get_cached_dna(source["id"]) if source["id"] else None
    if cached is None:
        raw = await get_categorized_candidates(book)
        if raw and source["id"]:
            save_dna(source["id"], raw)
    else:
        raw = cached

    if not raw:
        return {"book": source, "categories": [], "fallback": True}

    validated = await asyncio.gather(
        *[validate_category(raw.get(label, [])) for label in CATEGORY_LABELS]
    )

    categories = [
        {"label": label, "books": books}
        for label, books in zip(CATEGORY_LABELS, validated)
        if books
    ]

    return {"book": source, "categories": categories, "fallback": False}
