from pathlib import Path

import json

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DB_PATH = PROJECT_ROOT / "data" / "games.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_startup_migrations() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "games" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("games")}
    with engine.begin() as conn:
        if "category" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN category VARCHAR(80)"))
        if "release_year" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN release_year INTEGER"))
        if "platform" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN platform VARCHAR(40)"))
        if "completion_hours" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN completion_hours FLOAT"))
        if "favorite" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN favorite BOOLEAN DEFAULT 0"))
        if "categories_json" not in columns:
            conn.execute(text("ALTER TABLE games ADD COLUMN categories_json TEXT"))

    _migrate_legacy_categories()


def _migrate_legacy_categories() -> None:
    from app.models import Game

    db = SessionLocal()
    try:
        rows = db.query(Game).all()
        changed = False
        for game in rows:
            if game.categories_json and game.categories_json.strip() not in ("", "[]"):
                continue
            if game.category:
                game.categories_json = json.dumps([game.category.strip()])
                changed = True
            else:
                game.categories_json = "[]"
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()
