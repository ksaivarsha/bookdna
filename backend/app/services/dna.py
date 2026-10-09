import json
import logging
import os
import anthropic

# Log exception type names only: messages and request details are never logged,
# so the API key cannot end up in the logs.
logger = logging.getLogger(__name__)

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


_warned_no_key = False


def _api_key() -> str:
    global _warned_no_key
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key and not _warned_no_key:
        logger.warning("ANTHROPIC_API_KEY is not set; AI features are disabled")
        _warned_no_key = True
    return key


def _text(message, step: str) -> str | None:
    logger.info(
        "usage step=%s in=%d out=%d",
        step.replace(" ", "_"), message.usage.input_tokens, message.usage.output_tokens,
    )
    if message.stop_reason != "end_turn":
        logger.warning("%s: Claude stopped with stop_reason=%s", step, message.stop_reason)
    block = next((b for b in message.content if b.type == "text"), None)
    if block is None:
        logger.warning("%s: Claude response had no text block", step)
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
        raw = _text(message, "profile extraction")
        if raw is None:
            return None
        profile = json.loads(raw)
        profile["tropes"] = [t.strip().lower() for t in profile["tropes"] if t.strip()]
        return profile
    except Exception as e:
        logger.error("profile extraction failed: %s", type(e).__name__)
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

    return await _ask_categories(api_key, prompt, "book recommendations")


TASTE_LABELS = [
    "Tropes You Return To",
    "Worlds You Wander",
    "Your Subgenres",
]


def _ranked(items: list[tuple[str, int]], total: int) -> str:
    return "; ".join(f"{name} ({count} of {total} books)" for name, count in items)


async def get_taste_candidates(taste: dict, read_titles: list[str]) -> dict | None:
    """
    Ask Claude for recommendations matching an aggregated taste profile:
    {tropes, settings, subgenres: [(name, count)], book_count}.
    Returns a dict keyed by TASTE_LABELS, each a list of {title, author, reason}.
    Returns None if no API key or any error.
    """
    api_key = _api_key()
    if not api_key:
        return None

    total = taste["book_count"]
    already = "; ".join(read_titles)

    prompt = f"""You are a literary expert building a personal shelf for a reader.
Across the last {total} books they looked up, these elements recur most (most frequent first):

Tropes: {_ranked(taste["tropes"], total)}
Worlds/settings: {_ranked(taste["settings"], total)}
Subgenres: {_ranked(taste["subgenres"], total)}

Books they already looked up (do NOT recommend these): {already}

Recommend real existing books in exactly three categories. Only recommend books you are
highly confident actually exist. Weight the most frequent elements most heavily, and order
each list best match first.
- "{TASTE_LABELS[0]}": books built on their top tropes.
- "{TASTE_LABELS[1]}": books set in worlds like their top settings.
- "{TASTE_LABELS[2]}": standout books in their top subgenres.

For each category, provide exactly 6 real books with the exact title, the author's full name,
and a one-line reason (under 15 words) naming which of their recurring elements it matches.

Return ONLY valid JSON — no markdown, no explanation, no code fences — in this exact shape:
{{
  "{TASTE_LABELS[0]}": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ],
  "{TASTE_LABELS[1]}": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ],
  "{TASTE_LABELS[2]}": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ]
}}"""

    return await _ask_categories(api_key, prompt, "taste recommendations")


async def _ask_categories(api_key: str, prompt: str, step: str) -> dict | None:
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=16000,  # room for adaptive thinking plus 18–24 books of JSON
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _text(message, step)
        if raw is None:
            return None
        raw = raw.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            logger.warning("%s: no JSON object in Claude response", step)
            return None
        return json.loads(raw[start:end])
    except Exception as e:
        logger.error("%s failed: %s", step, type(e).__name__)
        return None
