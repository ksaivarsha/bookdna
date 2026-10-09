"""
Pre-warm the BookDNA cache for a list of popular books, so their first search
is instant: Open Library lookups, DNA profile, and validated shelves are all
stored exactly as a real search would store them. Search history is not touched.

    cd backend
    python scripts/prewarm.py --db /tmp/prewarm.db            # a scratch database
    python scripts/prewarm.py --db ../bookdna.db --i-mean-the-real-db
    python scripts/prewarm.py --db /tmp/x.db --books my_list.txt --limit 5

Books already cached (profile and shelves) are skipped. Each new book makes two
Claude calls (about $0.002 on Haiku 5.5); token totals are printed at the end.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL_DB = os.path.normcase(os.path.realpath(os.path.join(BACKEND, "..", "bookdna.db")))

# Romantasy and fantasy favorites. Most entries add the author to pin the match; a few use
# the plain title so they resolve to the same work a reader's search does.
POPULAR_BOOKS = [
    "Fourth Wing Rebecca Yarros",
    "Iron Flame Rebecca Yarros",
    "A Court of Thorns and Roses Sarah J. Maas",
    "A Court of Mist and Fury Sarah J. Maas",
    "House of Earth and Blood Sarah J. Maas",
    "Throne of Glass Sarah J. Maas",
    "The Cruel Prince Holly Black",
    "The Wicked King Holly Black",
    "Six of Crows Leigh Bardugo",
    "Shadow and Bone Leigh Bardugo",
    "Ninth House Leigh Bardugo",
    "Circe Madeline Miller",
    "The Song of Achilles Madeline Miller",
    "The Night Circus Erin Morgenstern",
    "The Starless Sea Erin Morgenstern",
    "Caraval Stephanie Garber",
    "Once Upon a Broken Heart Stephanie Garber",
    "Serpent and Dove",  # with the author it matches a boxed set
    "From Blood and Ash Jennifer L. Armentrout",
    "Kingdom of the Wicked Kerri Maniscalco",
    "The Invisible Life of Addie LaRue V. E. Schwab",
    "A Darker Shade of Magic V. E. Schwab",
    "Uprooted Naomi Novik",
    "Spinning Silver Naomi Novik",
    "A Deadly Education Naomi Novik",
    "The Priory of the Orange Tree Samantha Shannon",
    "The Name of the Wind Patrick Rothfuss",
    "Mistborn The Final Empire Brandon Sanderson",
    "The Way of Kings Brandon Sanderson",
    "Red Queen Victoria Aveyard",
    "An Ember in the Ashes Sabaa Tahir",
    "Children of Blood and Bone Tomi Adeyemi",
    "The Poppy War R. F. Kuang",
    "Babel R. F. Kuang",
    "Divine Rivals Rebecca Ross",
    "Powerless Lauren Roberts",
    "The Serpent and the Wings of Night Carissa Broadbent",
    "The Bridge Kingdom Danielle L. Jensen",
    "Daughter of Smoke and Bone Laini Taylor",
    "Strange the Dreamer Laini Taylor",
    "Piranesi Susanna Clarke",
    "Mexican Gothic",  # Open Library spells the author Moreno-García
    "The House in the Cerulean Sea TJ Klune",
    "Legends & Lattes",  # with the author it matches a two-book omnibus
    "Emily Wilde's Encyclopaedia of Faeries Heather Fawcett",
    "The Atlas Six Olivie Blake",
    "A Curse So Dark and Lonely Brigid Kemmerer",
    "Heartless Marissa Meyer",
    "Cinder Marissa Meyer",
    "The Hobbit J. R. R. Tolkien",
]

PRICE_IN, PRICE_OUT = 0.10 / 1e6, 0.50 / 1e6  # Haiku 5.5, prompts under 100K tokens


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db", required=True, help="SQLite database to warm (created if missing)")
    p.add_argument("--i-mean-the-real-db", action="store_true",
                   help="required to warm the app's real bookdna.db")
    p.add_argument("--books", help="text file with one search per line (default: built-in list)")
    p.add_argument("--limit", type=int, help="only the first N books")
    p.add_argument("--concurrency", type=int, default=3, help="books processed at once (default 3)")
    return p.parse_args()


class UsageTally(logging.Handler):
    """Sum the `usage step=... in=N out=N` lines app.services.dna logs per Claude call."""
    def __init__(self):
        super().__init__()
        self.tokens_in = self.tokens_out = 0

    def emit(self, record):
        m = re.match(r"usage step=\S+ in=(\d+) out=(\d+)", record.getMessage())
        if m:
            self.tokens_in += int(m[1])
            self.tokens_out += int(m[2])


async def warm_one(query, sem, search_books, dna_events, db):
    async with sem:
        start = time.perf_counter()
        try:
            source = (await search_books(query))["source"]
        except Exception as e:  # HTTPException for not found / Open Library down
            reasons = {404: "not found on Open Library", 503: "Open Library unreachable"}
            return query, reasons.get(getattr(e, "status_code", None), f"search failed ({type(e).__name__})")
        book_id = source["id"]
        if book_id and db.get_profile(book_id) and db.get_cached_dna(book_id):
            return source["title"], "already cached"

        shelves, fallback = 0, True
        async for line in dna_events(source):
            event = json.loads(line)
            if event["type"] == "shelf":
                shelves += 1
            elif event["type"] == "done":
                fallback = event["fallback"]
        cached = bool(db.get_cached_dna(book_id))
        status = f"{shelves} shelves" + ("" if cached else ", NOT cached (incomplete)")
        if fallback:
            status = "no shelves (Claude unavailable?)"
        return source["title"], f"{status} in {time.perf_counter() - start:.1f}s"


async def main():
    args = parse_args()
    db_path = os.path.realpath(args.db)
    if os.path.normcase(db_path) == REAL_DB and not args.i_mean_the_real_db:
        sys.exit(f"Refusing to write to the app's real database ({db_path}).\n"
                 "Pass --i-mean-the-real-db if that is what you want.")

    # Point the app at the chosen database before anything opens it
    os.environ["BOOKDNA_DB_PATH"] = db_path
    sys.path.insert(0, BACKEND)
    os.chdir(BACKEND)
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BACKEND, ".env"))
    import app.db as db
    db.DB_PATH = db_path
    db.init_db()
    from app.routes.books import search_books
    from app.routes.recommendations import _dna_events

    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    tally = UsageTally()
    dna_logger = logging.getLogger("app.services.dna")
    dna_logger.addHandler(tally)
    dna_logger.setLevel(logging.INFO)
    dna_logger.propagate = False  # keep per-call usage lines off the console

    if args.books:
        with open(args.books, encoding="utf-8") as f:
            books = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    else:
        books = POPULAR_BOOKS
    books = books[: args.limit] if args.limit else books

    print(f"Warming {len(books)} books into {db_path} (estimated cost up to ${len(books) * 0.0025:.2f})", flush=True)
    sem = asyncio.Semaphore(args.concurrency)
    start = time.perf_counter()
    for task in asyncio.as_completed([warm_one(q, sem, search_books, _dna_events, db) for q in books]):
        title, status = await task
        print(f"  {title[:48]:48} {status}", flush=True)

    cost = tally.tokens_in * PRICE_IN + tally.tokens_out * PRICE_OUT
    print(f"Done in {time.perf_counter() - start:.0f}s. Claude tokens: {tally.tokens_in:,} in / "
          f"{tally.tokens_out:,} out (about ${cost:.3f}).")


if __name__ == "__main__":
    asyncio.run(main())
