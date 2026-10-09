import asyncio
import hashlib
import json
from collections import Counter
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.db import (
    add_to_history,
    get_history,
    get_profile,
    get_taste_recs,
    save_taste_recs,
)
from app.services.dna import TASTE_LABELS, get_taste_candidates
from app.routes.recommendations import ensure_profile, validate_category

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


def aggregate_taste(profiles: list[dict]) -> dict:
    """Count the most frequent tropes, settings and subgenres across profiles."""
    tropes, settings, subgenres = Counter(), Counter(), Counter()
    for p in profiles:
        # set() so a book counts each trope once
        tropes.update({_norm(t) for t in p.get("tropes", []) if _norm(t)})
        if _norm(p.get("world_setting", "")):
            settings[_norm(p["world_setting"])] += 1
        if _norm(p.get("subgenre", "")):
            subgenres[_norm(p["subgenre"])] += 1
    return {
        "book_count": len(profiles),
        "tropes": tropes.most_common(6),
        "settings": settings.most_common(3),
        "subgenres": subgenres.most_common(3),
    }


def _taste_key(taste: dict, read_titles: list[str]) -> str:
    stable = json.dumps([taste, sorted(read_titles)], separators=(",", ":"))
    return hashlib.sha256(stable.encode()).hexdigest()


@router.get("/{session_id}/for-you")
async def for_you(session_id: str):
    """
    Build a taste profile from the DNA profiles of the session's last 5 books
    (most frequent tropes, settings, subgenres) and generate For You shelves from it.
    If none of those books has a profile yet, one is extracted for the most recent book.
    """
    recent = get_history(session_id, limit=5)
    if not recent:
        return {"books": [], "categories": [], "taste": None, "fallback": False}

    contributing, profiles = [], []
    for entry in recent:
        profile = get_profile(entry["id"]) if entry["id"] else None
        if profile:
            contributing.append(entry)
            profiles.append(profile)

    if not profiles:
        source = recent[0]
        profile, _ = await ensure_profile({
            "id": source["id"],
            "title": source["title"],
            "authors": source["authors"],
            "description": "",
            "categories": [],
        })
        if not profile:
            return {"books": [source], "categories": [], "taste": None, "fallback": True}
        contributing, profiles = [source], [profile]

    taste = aggregate_taste(profiles)

    # Exclude everything the session has looked up, not just the last 5
    seen = get_history(session_id, limit=50)
    seen_ids = {b["id"] for b in seen}
    seen_titles = list(dict.fromkeys(b["title"] for b in seen))

    key = _taste_key(taste, seen_titles)
    raw = get_taste_recs(key)
    if raw is None:
        raw = await get_taste_candidates(taste, seen_titles)
        if raw:
            save_taste_recs(key, raw)
    if not raw:
        return {"books": contributing, "categories": [], "taste": taste, "fallback": True}

    seen_norm = {_norm(t) for t in seen_titles}
    validated = await asyncio.gather(*[
        validate_category(
            [c for c in _dedup(raw.get(label, [])) if _norm(c.get("title", "")) not in seen_norm]
        )
        for label in TASTE_LABELS
    ])

    # Drop books from earlier shelves and anything already looked up
    used, categories = set(seen_ids), []
    for label, books in zip(TASTE_LABELS, validated):
        books = [b for b in books if b["id"] not in used]
        used.update(b["id"] for b in books)
        if books:
            categories.append({"label": label, "books": books})

    return {
        "books": contributing,   # books whose profiles shaped the taste (1–5)
        "categories": categories,
        "taste": taste,
        "fallback": False,
    }
