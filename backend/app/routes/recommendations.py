import asyncio
from fastapi import APIRouter
import httpx
from app.db import get_cached_dna, save_dna
from app.services.dna import get_categorized_candidates

router = APIRouter()

CATEGORY_LABELS = [
    "Similar Storyline",
    "Similar Tropes",
    "Similar World/Setting",
    "Same Vibe",
]


def _normalize(s: str) -> str:
    return "".join(c.lower() for c in s if c.isalnum() or c.isspace()).strip()


async def _validate_candidate(
    client: httpx.AsyncClient, candidate: dict
) -> dict | None:
    title = candidate.get("title", "")
    author = candidate.get("author", "")
    reason = candidate.get("reason", "")

    try:
        resp = await client.get(
            "https://openlibrary.org/search.json",
            params={
                "title": title,
                "author": author,
                "limit": 1,
                "fields": "key,title,author_name,cover_i",
            },
        )
        docs = resp.json().get("docs", [])
    except Exception:
        return None

    if not docs:
        return None

    doc = docs[0]
    ol_norm = _normalize(doc.get("title", ""))
    cand_norm = _normalize(title)
    words = [w for w in cand_norm.split() if len(w) > 2]
    if not words:
        return None
    if sum(1 for w in words if w in ol_norm) / len(words) < 0.5:
        return None

    cover_id = doc.get("cover_i")
    return {
        "id": doc.get("key", ""),
        "title": doc.get("title", title),
        "authors": doc.get("author_name", [author]),
        "cover": (
            f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
            if cover_id
            else ""
        ),
        "reason": reason,
    }


async def validate_category(candidates: list) -> list:
    async with httpx.AsyncClient(timeout=15.0) as client:
        results = await asyncio.gather(
            *[_validate_candidate(client, c) for c in candidates]
        )
    return [r for r in results if r][:6]


@router.post("/by-category")
async def recommendations_by_category(book: dict):
    book_id = book.get("id", "")

    cached = get_cached_dna(book_id) if book_id else None
    if cached is None:
        raw = await get_categorized_candidates(book)
        if raw and book_id:
            save_dna(book_id, raw)
    else:
        raw = cached

    if not raw:
        return {"categories": [], "fallback": True}

    validated = await asyncio.gather(
        *[validate_category(raw.get(label, [])) for label in CATEGORY_LABELS]
    )

    categories = [
        {"label": label, "books": books}
        for label, books in zip(CATEGORY_LABELS, validated)
        if books
    ]

    return {"categories": categories, "fallback": False}
