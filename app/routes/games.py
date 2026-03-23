import json
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import Game, GameScreenshot, User
from app.pdf_export import build_games_pdf

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".avif", ".webp"}
MAX_IMAGES_PER_GAME = 20

CATEGORY_OPTIONS = frozenset(
    {
        "RPG",
        "Action",
        "Adventure",
        "Strategy",
        "Simulation",
        "Sports",
        "Racing",
        "Puzzle",
        "Horror",
        "FPS",
        "PVE",
        "PVP",
        "Romantic",
        "Indie",
        "Sandbox",
        "Other",
    }
)

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def _parse_categories(game: Game) -> list[str]:
    if game.categories_json:
        try:
            data = json.loads(game.categories_json)
            if isinstance(data, list):
                return sorted({str(x) for x in data if str(x) in CATEGORY_OPTIONS})
        except (json.JSONDecodeError, TypeError):
            pass
    if game.category:
        raw = str(game.category)
        parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
        found = [p for p in parts if p in CATEGORY_OPTIONS]
        if found:
            return sorted(set(found))
        return ["Other"]
    return []


def _dump_categories(categories: list[str]) -> str:
    normalized = sorted({c for c in categories if c in CATEGORY_OPTIONS})
    return json.dumps(normalized)


def _delete_files_if_orphaned(filenames: set[str]) -> None:
    for name in filenames:
        path = UPLOADS_DIR / name
        if path.is_file():
            path.unlink()


class GameBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    status: str = Field(default="Wishlist", max_length=30)
    rating: float | None = Field(default=None, ge=0, le=10)
    categories: list[str] = Field(default_factory=list)
    release_year: int | None = Field(default=None, ge=1970, le=2100)
    platform: str | None = Field(default=None, max_length=40)
    completion_hours: float | None = Field(default=None, ge=0, le=10000)
    favorite: bool = False
    notes: str | None = None
    cover_filename: str | None = None
    screenshots: list[str] = Field(default_factory=list)

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: list[str]) -> list[str]:
        cleaned = [c.strip() for c in value if c and c.strip() in CATEGORY_OPTIONS]
        return sorted(set(cleaned))


class GameCreate(GameBase):
    pass


class GameUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, max_length=30)
    rating: float | None = Field(default=None, ge=0, le=10)
    categories: list[str] | None = None
    release_year: int | None = Field(default=None, ge=1970, le=2100)
    platform: str | None = Field(default=None, max_length=40)
    completion_hours: float | None = Field(default=None, ge=0, le=10000)
    favorite: bool | None = None
    notes: str | None = None
    cover_filename: str | None = None
    screenshots: list[str] | None = None

    @field_validator("categories")
    @classmethod
    def validate_categories_update(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [c.strip() for c in value if c and c.strip() in CATEGORY_OPTIONS]
        return sorted(set(cleaned))


class GameOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    rating: float | None
    categories: list[str]
    release_year: int | None
    platform: str | None
    completion_hours: float | None
    favorite: bool
    notes: str | None
    cover: str | None
    screenshots: list[str]


class ExportPdfBody(BaseModel):
    ids: list[int] = Field(default_factory=list)


def serialize_game(game: Game) -> GameOut:
    return GameOut(
        id=game.id,
        title=game.title,
        status=game.status,
        rating=game.rating,
        categories=_parse_categories(game),
        release_year=game.release_year,
        platform=game.platform,
        completion_hours=game.completion_hours,
        favorite=bool(game.favorite),
        notes=game.notes,
        cover=game.cover_filename,
        screenshots=[shot.filename for shot in game.screenshots],
    )


def _normalize_filename(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image format.")
    return f"{uuid4().hex}{suffix}"


def _save_upload(file: UploadFile) -> str:
    filename = _normalize_filename(file.filename or "")
    target = UPLOADS_DIR / filename
    with target.open("wb") as output:
        output.write(file.file.read())
    return filename


def _collect_image_filenames(game: Game) -> set[str]:
    names = {s.filename for s in game.screenshots}
    if game.cover_filename:
        names.add(game.cover_filename)
    return names


def _unique_image_count_for_payload(screenshots: list[str], cover: str | None) -> int:
    names = set(screenshots)
    if cover:
        names.add(cover)
    return len(names)


@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "request": request,
            "page_title": "Games Showcase",
        },
    )


@router.get("/api/games", response_class=JSONResponse)
async def get_games(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    games = (
        db.query(Game)
        .filter(Game.owner_id == current_user.id)
        .order_by(Game.updated_at.desc(), Game.created_at.desc())
        .all()
    )
    return {"games": [serialize_game(game).model_dump() for game in games]}


@router.post("/api/games", response_class=JSONResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    payload: GameCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _unique_image_count_for_payload(payload.screenshots, payload.cover_filename) > MAX_IMAGES_PER_GAME:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES_PER_GAME} images per game.")
    game = Game(
        owner_id=current_user.id,
        title=payload.title.strip(),
        status=payload.status.strip() or "Wishlist",
        rating=payload.rating,
        categories_json=_dump_categories(payload.categories),
        release_year=payload.release_year,
        platform=(payload.platform or "").strip() or None,
        completion_hours=payload.completion_hours,
        favorite=payload.favorite,
        notes=payload.notes,
        cover_filename=payload.cover_filename,
    )
    for screenshot in payload.screenshots:
        game.screenshots.append(GameScreenshot(filename=screenshot))
    db.add(game)
    db.commit()
    db.refresh(game)
    return {"game": serialize_game(game).model_dump()}


@router.put("/api/games/{game_id}", response_class=JSONResponse)
@router.patch("/api/games/{game_id}", response_class=JSONResponse)
async def update_game(
    game_id: int,
    payload: GameUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = db.query(Game).filter(Game.id == game_id, Game.owner_id == current_user.id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    old_files = _collect_image_filenames(game)

    updates = payload.model_dump(exclude_unset=True)
    if "title" in updates and updates["title"] is not None:
        updates["title"] = updates["title"].strip()
        if not updates["title"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title cannot be empty")
    if "status" in updates and updates["status"] is not None:
        updates["status"] = updates["status"].strip() or game.status
    if "platform" in updates and updates["platform"] is not None:
        updates["platform"] = updates["platform"].strip() or None
    if "categories" in updates and updates["categories"] is not None:
        updates["categories_json"] = _dump_categories(updates.pop("categories"))

    for field, value in updates.items():
        if field == "screenshots" and value is not None:
            game.screenshots = [GameScreenshot(filename=item) for item in value]
            continue
        setattr(game, field, value)

    db.flush()
    if _unique_image_count_for_payload([s.filename for s in game.screenshots], game.cover_filename) > MAX_IMAGES_PER_GAME:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES_PER_GAME} images per game.")

    db.commit()
    db.refresh(game)

    new_files = _collect_image_filenames(game)
    removed = old_files - new_files
    _delete_files_if_orphaned(removed)

    return {"game": serialize_game(game).model_dump()}


@router.delete("/api/games/{game_id}", response_class=JSONResponse)
async def delete_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = db.query(Game).filter(Game.id == game_id, Game.owner_id == current_user.id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    files = _collect_image_filenames(game)
    db.delete(game)
    db.commit()
    _delete_files_if_orphaned(files)

    return {"ok": True}


@router.post("/api/uploads", response_class=JSONResponse, status_code=status.HTTP_201_CREATED)
async def upload_images(
    files: list[UploadFile] = File(...),
    game_id: int | None = Form(default=None),
    set_cover: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    if game_id is not None:
        game = db.query(Game).filter(Game.id == game_id, Game.owner_id == current_user.id).first()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        before = len(_collect_image_filenames(game))
        if before + len(files) > MAX_IMAGES_PER_GAME:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_IMAGES_PER_GAME} images per game (including cover).",
            )

    saved = []
    for file in files:
        saved.append(_save_upload(file))

    if game_id is not None:
        game = db.query(Game).filter(Game.id == game_id, Game.owner_id == current_user.id).first()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        for filename in saved:
            game.screenshots.append(GameScreenshot(filename=filename))
        if set_cover and saved:
            game.cover_filename = saved[0]
        db.commit()

    return {"files": saved, "urls": [f"/uploads/{name}" for name in saved]}


@router.post("/api/games/export/pdf")
async def export_games_pdf(
    body: ExportPdfBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.ids:
        raise HTTPException(status_code=400, detail="No game ids provided.")
    games = (
        db.query(Game)
        .filter(Game.owner_id == current_user.id, Game.id.in_(body.ids))
        .all()
    )
    order = {gid: i for i, gid in enumerate(body.ids)}
    games.sort(key=lambda g: order.get(g.id, 9999))
    pdf_bytes = build_games_pdf(games, UPLOADS_DIR)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="games-showcase-export.pdf"'},
    )
