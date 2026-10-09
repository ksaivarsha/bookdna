import asyncio
import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import httpx
from app.db import get_cached_dna, save_dna, get_profile, save_profile
from app.services.dna import SHELF_KEYS, extract_profile, stream_recommendations
from app.services.ol import search as ol_search
from app.timing import stage

# Validation lookups are many and small; a short timeout keeps one slow
# Open Library response from holding up a whole shelf.
VALIDATE_TIMEOUT = 3.0

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
        timeout=VALIDATE_TIMEOUT,
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


def _event(obj: dict) -> str:
    return json.dumps(obj) + "\n"


async def _dna_events(book: dict):
    """
    NDJSON events for the search page, each sent as soon as it is ready:
        {"type": "profile", "profile": {...}}
        {"type": "shelf", "label": ..., "books": [...]}   per validated shelf
        {"type": "done", "fallback": bool}                always last
    Shelves are validated while Claude is still generating the later ones.
    """
    book_id = book.get("id", "")
    shelves_sent = 0
    producer = None
    try:
        with stage("profile"):
            profile, new_profile = await ensure_profile(book)
        if profile:
            yield _event({"type": "profile", "profile": profile})

        # Cached recommendations predating this book's profile were generated
        # without it, so regenerate them when the profile is new.
        cached = get_cached_dna(book_id) if book_id and not new_profile else None

        queue: asyncio.Queue = asyncio.Queue()
        counts = {"passed": 0, "suggested": 0}

        async def validate(label: str, candidates: list):
            with stage("validation_" + SHELF_KEYS[label]):
                books = await validate_category(candidates)
            counts["passed"] += len(books)
            counts["suggested"] += len(candidates)
            await queue.put((label, books))

        async def produce():
            tasks = []
            try:
                if cached:
                    for label in CATEGORY_LABELS:
                        tasks.append(asyncio.create_task(validate(label, cached.get(label, []))))
                else:
                    raw = {}
                    with stage("recommendations"):
                        async for label, candidates in stream_recommendations(book, profile):
                            raw[label] = candidates
                            tasks.append(asyncio.create_task(validate(label, candidates)))
                    if book_id and len(raw) == len(CATEGORY_LABELS):
                        save_dna(book_id, raw)
                await asyncio.gather(*tasks)
            finally:
                await queue.put(None)

        producer = asyncio.create_task(produce())
        while (item := await queue.get()) is not None:
            label, books = item
            if books:
                shelves_sent += 1
                yield _event({"type": "shelf", "label": label, "books": books})
        await producer  # re-raise anything the producer hit
        logger.info("validation passed=%d of=%d", counts["passed"], counts["suggested"])
    except Exception as e:
        logger.error("dna stream failed: %s", type(e).__name__)
    finally:
        if producer and not producer.done():
            producer.cancel()  # client went away mid-stream
    yield _event({"type": "done", "fallback": shelves_sent == 0})


@router.post("/by-category")
async def recommendations_by_category(book: dict):
    return StreamingResponse(_dna_events(book), media_type="application/x-ndjson")
