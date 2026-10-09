"""
Centralised Open Library access: cache-first, one retry, configurable timeout.

search() returns:
    list[dict]  — OL docs (may be empty list = no results)
    None        — OL unreachable and no cached result available
"""

import asyncio
import hashlib
import json
import httpx
from app.db import get_ol_cache, set_ol_cache

BASE = "https://openlibrary.org"
TIMEOUT = 8.0       # seconds per attempt
RETRY_DELAY = 0.4   # seconds between attempts


def _key(params: dict) -> str:
    stable = json.dumps(sorted(params.items()), separators=(",", ":"))
    return hashlib.sha256(stable.encode()).hexdigest()


async def search(
    params: dict,
    *,
    client: httpx.AsyncClient | None = None,
) -> list | None:
    key = _key(params)
    cached = get_ol_cache(key)
    if cached is not None:
        return cached  # serves stale cache during outages

    async def _attempt(c: httpx.AsyncClient) -> list | None:
        for attempt in range(2):
            try:
                r = await c.get(
                    f"{BASE}/search.json", params=params, timeout=TIMEOUT
                )
                return r.json().get("docs", [])
            except (
                httpx.TimeoutException,
                httpx.ConnectError,
                httpx.RemoteProtocolError,
            ):
                if attempt == 1:
                    return None
                await asyncio.sleep(RETRY_DELAY)
        return None

    if client is not None:
        docs = await _attempt(client)
    else:
        async with httpx.AsyncClient() as c:
            docs = await _attempt(c)

    if docs is not None:
        set_ol_cache(key, docs)

    return docs


def _extract_description(work: dict) -> str:
    # OL stores description as either a plain string or {"type": ..., "value": ...}
    desc = work.get("description", "")
    if isinstance(desc, dict):
        desc = desc.get("value", "")
    return desc.strip() if isinstance(desc, str) else ""


async def work_description(work_key: str) -> str:
    """
    Fetch a work's description from /works/{id}.json (cache-first, one retry).
    Returns "" if the work has no description or OL is unreachable.
    """
    if not work_key.startswith("/works/"):
        return ""

    key = _key({"work": work_key})
    cached = get_ol_cache(key)
    if cached is not None:
        return cached.get("description", "")

    async with httpx.AsyncClient() as c:
        for attempt in range(2):
            try:
                r = await c.get(f"{BASE}{work_key}.json", timeout=TIMEOUT)
                if r.status_code != 200:
                    return ""
                description = _extract_description(r.json())
                set_ol_cache(key, {"description": description})
                return description
            except (
                httpx.TimeoutException,
                httpx.ConnectError,
                httpx.RemoteProtocolError,
            ):
                if attempt == 1:
                    return ""
                await asyncio.sleep(RETRY_DELAY)
    return ""
