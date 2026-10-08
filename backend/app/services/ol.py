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
