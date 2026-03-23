<p align="center">
  <strong>Games Showcase</strong><br/>
  <sub>A premium self-hosted dashboard for the games you’ve finished, you’re playing, and the worlds you still want to explore.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License" />
</p>

---

## Overview

**Games Showcase** is a private, multi-user web app to catalog your game library: status (played / playing / wishlist), categories, ratings, platforms, completion time, favorites, notes, and image galleries with slideshow. Export your visible library to **PDF**, switch **light / dark** themes, and keep everything on **your** machine.

---

## Screenshots

<p align="center">
  <img src="Screenshots/screenshot-dark.png" alt="Library view - dark theme" width="780"/><br/>
  <em>Dark theme — library & filters</em>
</p>

<p align="center">
  <img src="Screenshots/screenshot-light.png" alt="Library view - light theme" width="780"/><br/>
  <em>Light theme — same layout, tuned for readability</em>
</p>

<p align="center">
  <img src="Screenshots/screenshot-modal.png" alt="Add or edit game modal" width="720"/><br/>
  <em>Add / edit game — categories, media, notes</em>
</p>

---

## Features

| | |
|---|---|
| **Accounts** | Register, login, session-based auth; data scoped per user |
| **Library** | Search, filter by status & category, favorites-only toggle |
| **Games** | Title, status, multi-category chips, rating, year, platform, hours, notes |
| **Media** | Up to 20 images per game, drag-and-drop & folder upload, cover + slideshow |
| **Export** | PDF export of games currently visible in the grid |
| **UI** | Glass-style UI, responsive layout, light/dark theme, in-app help |

---

## Tech stack

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [SQLAlchemy](https://www.sqlalchemy.org/) + SQLite  
- **Auth:** Signed cookies ([Starlette sessions](https://www.starlette.io/middleware/#sessionsmiddleware)), [Passlib](https://passlib.readthedocs.io/) (PBKDF2-SHA256)  
- **Frontend:** Jinja2 templates, vanilla JS, custom CSS  
- **PDF:** [ReportLab](https://www.reportlab.com/)

---

## Requirements

- **Python 3.10+** recommended  
- `pip` (or another PEP 517 installer)

---

## Quick start

```bash
# Clone
git clone https://github.com/manxlr/games-showcase.git
cd games-showcase

# Virtual environment (recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux / macOS:
# source venv/bin/activate

pip install -r requirements.txt
```

### Run the app

```bash
python run.py
```

Open **http://127.0.0.1:4000** — register a user, then sign in.

### Production-ish settings

Set a strong session secret (required for real deployments):

```bash
# Windows PowerShell
$env:SESSION_SECRET = "your-long-random-secret"

# Linux / macOS
export SESSION_SECRET="your-long-random-secret"
```

Then start with the same `python run.py` (or run `uvicorn` directly — see `run.py` for host/port).

---

## Data layout

| Path | Purpose |
|------|---------|
| `data/games.db` | SQLite database (created on first run) |
| `data/uploads/` | Uploaded game images |

Both are **gitignored** by default so your library never gets committed by accident.

---

## API & docs

With the app running, interactive OpenAPI docs are at:

- **Swagger UI:** [http://127.0.0.1:4000/docs](http://127.0.0.1:4000/docs)  
- **ReDoc:** [http://127.0.0.1:4000/redoc](http://127.0.0.1:4000/redoc)

Health check: `GET /health`

---

## Branding (optional)

Add `app/static/icons/icon.png` and `app/static/icons/favicon.ico` for the navbar logo and browser tab icon. See [`app/static/icons/README.txt`](app/static/icons/README.txt).

---

## Roadmap

- [ ] Docker / Docker Compose  
- [ ] Optional desktop wrapper (Windows / Linux)  

Contributions and ideas are welcome via issues and pull requests.

---

## 📜 License

This project is licensed under the **MIT License**, allowing you to freely use, modify, and distribute the code.

**MIT License** — see the [`LICENSE`](LICENSE) file for full text.

---

## 📧 Contact

For any questions, suggestions, or feedback, please reach out:

- **Email:** [nszeeshankhalid@gmail.com](mailto:nszeeshankhalid@gmail.com)
- **GitHub:** [@manxlr](https://github.com/manxlr)

---

## 🔗 Links

- **[GitHub Repository](https://github.com/manxlr/games-showcase)**

---

## 💖 Donations

If you find this project helpful and would like to support its continued development, you can donate using the following cryptocurrency addresses:

| Asset | Address |
|-------|---------|
| **Ethereum (ETH)** | `0x23774348bc491Ff70F39c63f39B0e542a59b5B14` |
| **Bitcoin (BTC)** | `bc1qp7wltg8frvecuujjs9f3ck28r0s0h0qzld2fu6` |
| **Dogecoin (DOGE)** | `DTbwxMs4wenN2kUea77rHPQ8nbJrSk4o7D` |

Your support is greatly appreciated and helps maintain and improve open-source projects!
