from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()


def format_book(doc):
    cover_id = doc.get("cover_i")
    cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else ""
    return {
        "id": doc.get("key", ""),
        "title": doc.get("title", "Unknown Title"),
        "authors": doc.get("author_name", ["Unknown Author"]),
        "description": "",
        "categories": doc.get("subject", [])[:3],
        "cover": cover_url,
        "rating": doc.get("ratings_average"),
        "pages": doc.get("number_of_pages_median"),
        "published": str(doc.get("first_publish_year", "")),
    }


@router.get("/search")
async def search_books(q: str):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://openlibrary.org/search.json",
            params={
                "q": q.strip(),
                "limit": 1,
                "fields": "key,title,author_name,cover_i,subject,first_publish_year,number_of_pages_median,ratings_average",
            },
        )
        data = response.json()

    if not data.get("docs"):
        raise HTTPException(status_code=404, detail="Book not found")

    source_doc = data["docs"][0]
    source_book = format_book(source_doc)

    subjects = source_doc.get("subject", [])
    authors = source_doc.get("author_name", [])

    if subjects:
        related_query = subjects[0]
    elif authors:
        related_query = authors[0]
    else:
        related_query = q.strip()

    async with httpx.AsyncClient(timeout=15.0) as client:
        related_response = await client.get(
            "https://openlibrary.org/search.json",
            params={
                "q": related_query,
                "limit": 10,
                "fields": "key,title,author_name,cover_i,subject,first_publish_year,number_of_pages_median,ratings_average",
            },
        )
        related_data = related_response.json()

    recommendations = [
        format_book(doc)
        for doc in related_data.get("docs", [])
        if doc.get("key") != source_doc.get("key")
    ][:6]

    return {"source": source_book, "recommendations": recommendations}
