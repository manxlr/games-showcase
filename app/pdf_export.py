"""High-quality PDF export for visible games (ReportLab)."""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.models import Game


def _categories_list(game: Game) -> list[str]:
    if game.categories_json:
        try:
            data = json.loads(game.categories_json)
            if isinstance(data, list):
                return [str(x) for x in data]
        except (json.JSONDecodeError, TypeError):
            pass
    if game.category:
        return [game.category]
    return []


def build_games_pdf(games: list[Game], uploads_dir: Path) -> bytes:
    """Build a print-quality PDF; embeds cover images when files exist."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Games Showcase Export",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="ExportTitle",
        parent=styles["h1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0d1a36"),
        spaceAfter=8,
    )
    body = ParagraphStyle(
        name="ExportBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1a2744"),
    )
    meta = ParagraphStyle(
        name="ExportMeta",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#42557d"),
    )

    story: list = []
    story.append(Paragraph("Games Showcase — Library Export", title_style))
    story.append(
        Paragraph(
            "High-quality export of your filtered game list. Images are embedded at 300 DPI max width.",
            meta,
        )
    )
    story.append(Spacer(1, 6 * mm))

    for idx, game in enumerate(games):
        if idx:
            story.append(Spacer(1, 6 * mm))

        cats = _categories_list(game)
        cat_line = ", ".join(cats) if cats else "—"
        safe_title = escape(str(game.title))
        lines = [
            f"<b>{safe_title}</b>",
            f"Status: {escape(str(game.status))} | Rating: {game.rating if game.rating is not None else '—'}/10",
            f"Categories: {escape(cat_line)}",
            f"Year: {game.release_year or '—'} | Platform: {escape(str(game.platform or '—'))} | Hours: {game.completion_hours if game.completion_hours is not None else '—'}",
        ]
        if game.notes:
            lines.append(f"Notes: {escape(str(game.notes))}")

        story.append(Paragraph("<br/>".join(lines), body))
        story.append(Spacer(1, 2 * mm))

        img_path = None
        if game.cover_filename:
            candidate = uploads_dir / game.cover_filename
            if candidate.is_file():
                img_path = candidate

        if img_path:
            try:
                w = 160 * mm
                h = 90 * mm
                story.append(RLImage(str(img_path), width=w, height=h))
            except OSError:
                story.append(Paragraph("(Cover image could not be embedded)", meta))

        story.append(Spacer(1, 2 * mm))

    doc.build(story)
    return buffer.getvalue()
