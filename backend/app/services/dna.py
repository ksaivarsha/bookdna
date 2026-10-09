import json
import os
import anthropic

MODEL = "claude-haiku-5-5"

_CATEGORY_LABELS = [
    "Similar Storyline",
    "Similar Tropes",
    "Similar World/Setting",
    "Same Vibe",
]

_PROFILE_SCHEMA = {
    "type": "object",
    "properties": {
        "tropes": {"type": "array", "items": {"type": "string"}},
        "world_setting": {"type": "string"},
        "subgenre": {"type": "string"},
        "tone": {"type": "string"},
        "storyline_summary": {"type": "string"},
    },
    "required": ["tropes", "world_setting", "subgenre", "tone", "storyline_summary"],
    "additionalProperties": False,
}


def _api_key() -> str:
    return os.getenv("ANTHROPIC_API_KEY", "").strip()


def _text(message) -> str | None:
    block = next((b for b in message.content if b.type == "text"), None)
    return block.text if block else None


def _book_header(book: dict, description_chars: int) -> str:
    title = book.get("title", "Unknown")
    authors = ", ".join(book.get("authors") or ["Unknown"])
    subjects = ", ".join(book.get("categories") or [])
    published = book.get("published", "")
    description = (book.get("description") or "")[:description_chars]
    return (
        f'Book: "{title}" by {authors}\n'
        f"Published: {published}\n"
        f"Genres: {subjects}\n"
        f"Description: {description}"
    )


async def extract_profile(book: dict) -> dict | None:
    """
    Ask Claude for a structured DNA profile of the book:
    {tropes: [str], world_setting, subgenre, tone, storyline_summary}.
    Returns None if no API key or any error.
    """
    api_key = _api_key()
    if not api_key:
        return None

    prompt = f"""You are a literary expert. Describe the DNA of the book below.

{_book_header(book, 2000)}

- tropes: 3 to 6 short, widely used trope names (e.g. "enemies to lovers", "chosen one", "found family"), lowercase.
- world_setting: the world or setting in a short phrase (e.g. "Victorian London", "fae courts", "near-future Mars colony").
- subgenre: the single most fitting subgenre (e.g. "romantasy", "cozy mystery", "space opera").
- tone: two or three words for the emotional tone (e.g. "dark and lush", "witty, warm").
- storyline_summary: one or two sentences summarizing the core storyline without spoilers.

Use your own knowledge of the book if the description is thin."""

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
            output_config={"format": {"type": "json_schema", "schema": _PROFILE_SCHEMA}},
        )
        raw = _text(message)
        if raw is None:
            return None
        profile = json.loads(raw)
        profile["tropes"] = [t.strip().lower() for t in profile["tropes"] if t.strip()]
        return profile
    except Exception:
        return None


def _profile_block(profile: dict | None) -> str:
    if not profile:
        return ""
    return (
        "\nBook DNA:\n"
        f"Tropes: {', '.join(profile.get('tropes', []))}\n"
        f"World/setting: {profile.get('world_setting', '')}\n"
        f"Subgenre: {profile.get('subgenre', '')}\n"
        f"Tone: {profile.get('tone', '')}\n"
        f"Storyline: {profile.get('storyline_summary', '')}\n"
    )


async def get_categorized_candidates(
    book: dict, profile: dict | None = None
) -> dict | None:
    """
    Ask Claude to generate categorized book recommendations for the given book,
    grounded in its DNA profile when one is available.
    Returns a dict keyed by category label, each value a list of
    {title, author, reason} dicts. Returns None if no API key or any error.
    """
    api_key = _api_key()
    if not api_key:
        return None

    title = book.get("title", "Unknown")

    prompt = f"""You are a literary expert. Given the book below, recommend real existing books
in exactly four categories. Only recommend books you are highly confident actually exist.

{_book_header(book, 400)}
{_profile_block(profile)}
Use the Book DNA to drive each category: "Similar Storyline" should match the storyline,
"Similar Tropes" should share its tropes, "Similar World/Setting" should match its world/setting
and subgenre, and "Same Vibe" should match its tone.

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

    return await _ask_categories(api_key, prompt)


async def _ask_categories(api_key: str, prompt: str) -> dict | None:
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _text(message)
        if raw is None:
            return None
        raw = raw.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        return json.loads(raw[start:end])
    except Exception:
        return None
