import asyncio
import logging
from fastapi import APIRouter
import httpx
from app.db import get_cached_dna, save_dna, get_profile, save_profile
from app.services.dna import extract_profile, get_categorized_candidates
from app.services.ol import search as ol_search
from app.timing import stage

logger = logging.getLogger(__name__)

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

    docs = await ol_search(
        {
            "title": title,
            "author": author,
            "limit": 1,
            "fields": "key,title,author_name,cover_i",
        },
        client=client,
    )

    # docs is None (OL unreachable, no cache) or [] (not found) — skip
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
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[_validate_candidate(client, c) for c in candidates]
        )
    return [r for r in results if r][:6]


async def ensure_profile(book: dict) -> tuple[dict | None, bool]:
    """
    Return (profile, newly_created). Uses the book_profile table first,
    otherwise asks Claude and stores the result.
    """
    book_id = book.get("id", "")
    profile = get_profile(book_id) if book_id else None
    if profile is not None:
        return profile, False
    profile = await extract_profile(book)
    if profile and book_id:
        save_profile(book_id, profile)
    return profile, profile is not None


@router.post("/by-category")
async def recommendations_by_category(book: dict):
    book_id = book.get("id", "")

    with stage("profile"):
        profile, new_profile = await ensure_profile(book)

    # Cached recommendations predating this book's profile were generated
    # without it, so regenerate them when the profile is new.
    cached = get_cached_dna(book_id) if book_id and not new_profile else None
    if cached is None:
        with stage("recommendations"):
            raw = await get_categorized_candidates(book, profile)
        if raw and book_id:
            save_dna(book_id, raw)
    else:
        raw = cached

    if not raw:
        return {"categories": [], "profile": profile, "fallback": True}

    with stage("validation"):
        validated = await asyncio.gather(
            *[validate_category(raw.get(label, [])) for label in CATEGORY_LABELS]
        )
    suggested = sum(len(raw.get(label, [])) for label in CATEGORY_LABELS)
    logger.info("validation passed=%d of=%d", sum(len(v) for v in validated), suggested)

    categories = [
        {"label": label, "books": books}
        for label, books in zip(CATEGORY_LABELS, validated)
        if books
    ]

    return {"categories": categories, "profile": profile, "fallback": False}
