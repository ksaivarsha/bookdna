from fastapi import APIRouter, HTTPException
from app.services.ol import search as ol_search

router = APIRouter()

_OL_DOWN = (
    "The library's archives are unreachable at the moment. "
    "Please try again shortly."
)

_FIELDS = (
    "key,title,author_name,cover_i,subject,"
    "first_publish_year,number_of_pages_median,ratings_average"
)


def format_book(doc: dict) -> dict:
    cover_id = doc.get("cover_i")
    return {
        "id": doc.get("key", ""),
        "title": doc.get("title", "Unknown Title"),
        "authors": doc.get("author_name", ["Unknown Author"]),
        "description": "",
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

    docs = await ol_search(
        {"q": q.strip(), "limit": 1, "fields": _FIELDS}
    )
    if docs is None:
        raise HTTPException(status_code=503, detail=_OL_DOWN)
    if not docs:
        raise HTTPException(status_code=404, detail="Book not found")

    source_doc = docs[0]
    source_book = format_book(source_doc)

    subjects = source_doc.get("subject", [])
    authors = source_doc.get("author_name", [])
    related_q = subjects[0] if subjects else (authors[0] if authors else q.strip())

    related_docs = await ol_search(
        {"q": related_q, "limit": 10, "fields": _FIELDS}
    )
    if related_docs is None:
        related_docs = []  # OL down for related — return source with empty recs

    recommendations = [
        format_book(doc)
        for doc in related_docs
        if doc.get("key") != source_doc.get("key")
    ][:6]

    return {"source": source_book, "recommendations": recommendations}
