from fastapi import APIRouter, HTTPException
from app.services.ol import search as ol_search, work_description
from app.timing import stage

router = APIRouter()

_OL_DOWN = (
    "The library's archives are unreachable at the moment. "
    "Please try again shortly."
)

_FIELDS = (
    "key,title,author_name,cover_i,subject,"
    "first_publish_year,number_of_pages_median,ratings_average"
)


def format_book(doc: dict, description: str = "") -> dict:
    cover_id = doc.get("cover_i")
    return {
        "id": doc.get("key", ""),
        "title": doc.get("title", "Unknown Title"),
        "authors": doc.get("author_name", ["Unknown Author"]),
        "description": description,
        "categories": doc.get("subject", [])[:3],
        "cover": (
            f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
            if cover_id
            else ""
        ),
        "rating": doc.get("ratings_average"),
        "pages": doc.get("number_of_pages_median"),
        "published": str(doc.get("first_publish_year", "")),
    }


@router.get("/search")
async def search_books(q: str):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")

    with stage("ol_search"):
        docs = await ol_search(
            {"q": q.strip(), "limit": 1, "fields": _FIELDS}
        )
    if docs is None:
        raise HTTPException(status_code=503, detail=_OL_DOWN)
    if not docs:
        raise HTTPException(status_code=404, detail="Book not found")

    source_doc = docs[0]
    with stage("description"):
        description = await work_description(source_doc.get("key", ""))
    return {"source": format_book(source_doc, description)}


@router.post("/related")
async def related_books(book: dict):
    """
    Genre picks for the search page: an Open Library search on the book's first
    subject (or first author, or title). Fetched separately from /search so the
    featured book can render without waiting for it.
    """
    subjects = book.get("categories") or []
    authors = book.get("authors") or []
    related_q = subjects[0] if subjects else (authors[0] if authors else book.get("title", ""))
    if not related_q:
        return {"recommendations": []}

    with stage("ol_related"):
        related_docs = await ol_search({"q": related_q, "limit": 10, "fields": _FIELDS})
    if related_docs is None:
        related_docs = []  # OL down: no genre picks rather than an error

    recommendations = [
        format_book(doc)
        for doc in related_docs
        if doc.get("key") != book.get("id")
    ][:6]
    return {"recommendations": recommendations}
