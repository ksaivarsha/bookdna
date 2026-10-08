import json
import os
import anthropic

MODEL = "claude-haiku-4-5"

_CATEGORY_LABELS = [
    "Similar Storyline",
    "Similar Tropes",
    "Similar World/Setting",
    "Same Vibe",
]


async def get_categorized_candidates(book: dict) -> dict | None:
    """
    Ask Claude to generate categorized book recommendations for the given book.
    Returns a dict keyed by category label, each value a list of
    {title, author, reason} dicts. Returns None if no API key or any error.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None

    title = book.get("title", "Unknown")
    authors = ", ".join(book.get("authors") or ["Unknown"])
    subjects = ", ".join(book.get("categories") or [])
    published = book.get("published", "")
    description = (book.get("description") or "")[:400]

    prompt = f"""You are a literary expert. Given the book below, recommend real existing books
in exactly four categories. Only recommend books you are highly confident actually exist.

Book: "{title}" by {authors}
Published: {published}
Genres: {subjects}
Description: {description}

For each category, provide exactly 6 real books with the exact title, the author's full name,
and a one-line reason (under 15 words) explaining why a fan of "{title}" would enjoy it.

Return ONLY valid JSON — no markdown, no explanation, no code fences — in this exact shape:
{{
  "Similar Storyline": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ],
  "Similar Tropes": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ],
  "Similar World/Setting": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ],
  "Same Vibe": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ]
}}"""

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=1800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        return json.loads(raw[start:end])
    except Exception:
        return None
