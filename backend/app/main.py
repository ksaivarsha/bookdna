from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes.books import router as books_router

load_dotenv()

app = FastAPI(title="BookDNA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books_router, prefix="/books")


@app.get("/")
def root():
    return {"message": "BookDNA API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
