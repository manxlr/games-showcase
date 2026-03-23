import importlib
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.database import Base, engine, run_startup_migrations
from app.routes import auth, games, help as help_routes

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

importlib.import_module("app.models")

app = FastAPI(
    title="Games Showcase",
    description="Premium self-hosted game library dashboard—finished, in progress, and wishlist in one place.",
    version="0.1.0",
)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "local-dev-secret-change-me"),
    same_site="lax",
    https_only=False,
)

Base.metadata.create_all(bind=engine)
run_startup_migrations()

app.include_router(auth.router)
app.include_router(help_routes.router)
app.include_router(games.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}