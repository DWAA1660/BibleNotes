# Bible Notes Web App

A Python + React project providing a multi-version Bible reader with advanced notes, backlinks, and community commentaries. The backend uses FastAPI with SQLite, while the frontend is a minimal React single-page interface.

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── utils/
│   │   │   ├── bible_loader.py
│   │   │   └── reference_parser.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── bible.py
│   │       ├── notes.py
│   │       └── commentaries.py
│   ├── requirements.txt
│   └── seeds/
│       └── seed_bible.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       └── components/
│           ├── Layout.css
│           ├── BiblePane.jsx
│           ├── CommentaryPane.jsx
│           ├── NotesPane.jsx
│           └── VersionSelector.jsx
├── bibles/
│   └── ... (existing Bible JSON assets)
└── README.md
```

## Backend Overview

- **Framework**: FastAPI
- **Database**: SQLite via SQLModel + Alembic-ready session pattern
- **Authentication**: JWT bearer tokens, bcrypt password hashing via Passlib
- **Markdown Rendering**: Markdown-it-py and Bleach for sanitization
- **Rate Limiting**: Simple in-memory limiter via `slowapi` (optional; included as scaffold)
- **Backlinking**: `reference_parser.py` scans Markdown for scripture references and stores normalized verse references in `note_cross_references`

### Data Model (SQLModel)

- **User**: account with email, hashed password, optional display name
- **BibleVersion**: metadata per version code, linked to verse content
- **Verse**: canonical verse entry (`canonical_id = book|chapter|verse`) keyed per version
- **Note**: user-authored note anchored to verse range (`start_verse_id`, `end_verse_id`), visibility (`public`/`private`)
- **NoteCrossReference**: backlinks to verses mentioned in note body
- **Commentary**: user-authored commentary collections, toggleable visibility
- **CommentaryEntry**: per-verse commentary entries
- **UserCommentarySubscription**: users subscribing to others' public commentaries

### API Highlights

- `POST /auth/signup`
- `POST /auth/login`
- `GET /versions`
- `GET /bible/{version}/{book}/{chapter}`
- `GET /notes/{version}/{book}/{chapter}`
- `POST /notes`
- `PUT /notes/{note_id}`
- `DELETE /notes/{note_id}`
- `GET /backlinks/{version}/{book}/{chapter}/{verse}`
- `POST /commentaries`
- `GET /commentaries/public`
- `POST /commentaries/{commentary_id}/subscribe`

### Backlink Flow

1. User submits Markdown content for a note.
2. `reference_parser` identifies references like `John 3:16-18` or `Romans 8:28`.
3. References map to canonical verse IDs using the loaded Bible metadata (`bible_loader`).
4. `NoteCrossReference` entries persist backlinks.
5. Verse endpoints include backlinks when fetching verses.

### Seeding Bible Data

`backend/seeds/seed_bible.py` imports verses from JSON files in `bibles/` into SQLite.

Usage:

```bash
# 1. Create virtual environment and install deps
python3 -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# 2. Initialize the database
python3 -m backend.app.database --init

# 3. Seed at least one version (example: ESV)
python3 backend/seeds/seed_bible.py --db backend/bible_notes.db --version ESV
```

## Production Seeding (Original-Language Manuscripts)

This project includes original-language manuscript editions (e.g., Greek WH/SCV, Hebrew OSHB) stored as JSON under `manuscripts/`.

Use `backend/seeds/seed_manuscripts.py` to import the already-downloaded assets into the production SQLite database. No network access is required for seeding if `manuscripts/` is present on the server.

Prerequisites:

- Python 3.10+
- Virtual environment with project dependencies installed:

```bash
# Linux/macOS
python3 -m venv venv
. venv/bin/activate
pip install -r backend/requirements.txt

# Windows (PowerShell)
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
```

Seed all available manuscript editions (recommended):

```bash
# Linux/macOS
python3 backend/seeds/seed_manuscripts.py --db backend/bible_notes.db --all --force --verbose

# Windows (PowerShell)
./venv/Scripts/python.exe backend/seeds/seed_manuscripts.py --db backend/bible_notes.db --all --force --verbose
```

Seed a specific edition (examples):

```bash
# OSHB (Hebrew OT)
python3 backend/seeds/seed_manuscripts.py --db backend/bible_notes.db --edition OSHB --force --verbose

# WH (Westcott–Hort Greek NT)
python3 backend/seeds/seed_manuscripts.py --db backend/bible_notes.db --edition WH --force --verbose

# SCV (Scrivener 1894 TR Greek NT)
python3 backend/seeds/seed_manuscripts.py --db backend/bible_notes.db --edition SCV --force --verbose
```

If your `manuscripts/` directory is located elsewhere, override with `--assets-dir`:

```bash
python3 backend/seeds/seed_manuscripts.py --db /srv/app/bible_notes.db \
  --all --force --verbose --assets-dir /srv/app/manuscripts
```

After seeding, verify via API (with the backend running):

```bash
curl http://127.0.0.1:8000/manuscripts/available/Genesis/1     # should list OSHB for OT
curl http://127.0.0.1:8000/manuscripts/available/John/1        # should list WH/SCV for NT
curl http://127.0.0.1:8000/manuscripts/OSHB/Genesis/1          # returns Hebrew text for Gen 1
```

Notes:

- Seeding normalizes book names to the app’s canonical labels (e.g., `1 Corinthians`, `Genesis`), so lookups match UI selections.
- `--force` overwrites existing verses for the selected edition(s); omit to skip re-seeding if already present.

## Frontend Overview

- **Stack**: Vite + React + Fetch API
- **Layout**: Three resizable panes (CSS grid)
- **State Management**: React hooks + simple context for auth token

### Local Development

Backend:

```bash
cd backend
uvicorn backend.app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

By default the Vite dev server binds to `localhost:5173`. If you are working from a different machine or need to access the app over your LAN, run:

```bash
cd frontend
npm install
npm run dev -- --host
```

Then open `http://localhost:5173/` (or the network URL Vite prints) in your browser while the backend API is running on port `8000`.

### Environment Variables

Create `backend/.env`:

```
DATABASE_URL=sqlite:///backend/bible_notes.db
JWT_SECRET=change_me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
```

## Testing

Add pytest tests in `backend/tests/` (scaffold included). Run with:

```bash
cd backend
pytest
```

## Next Steps

- Flesh out moderation endpoints and rate limiting policies
- Add OpenAPI tags/examples + client codegen configs
- Integrate full-text search via PostgreSQL FTS or external search service
- Expand React app with routing, user profile management, and offline caching
