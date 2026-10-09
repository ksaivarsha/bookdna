from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
import os

from app.db import init_db
from app.routes.books import router as books_router
from app.routes.recommendations import router as recs_router
from app.routes.history import router as history_router

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# httpx (and httpx2, used by the Anthropic SDK) log every request URL at INFO; keep them quiet
for name in ("httpx", "httpx2"):
    logging.getLogger(name).setLevel(logging.WARNING)

app = FastAPI(title="BookDNA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(books_router, prefix="/books")
app.include_router(recs_router, prefix="/recommendations")
app.include_router(history_router, prefix="/history")


@app.get("/")
def root():
    return {"message": "BookDNA API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
