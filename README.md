# CME_registration
Creating a web application for registration and record attendance of CME participants for Amrita hospital and its events.

See `CONTEXT.md` for the full functional requirements and architecture (including current
implementation status), and `docs/excel-schema.md` for the original workbook design (now
historical — Postgres is the live data store; Excel is import/export-only).

## Project layout

- `frontend/` — React + Vite + Tailwind CSS
- `backend/` — Python + FastAPI + SQLAlchemy + Alembic
- `docs/` — design docs
- `docker-compose.yml` — local-dev Postgres + Redis (app itself still runs on the host, see below)

## 1. Start infrastructure (Postgres + Redis)

```
docker compose up -d postgres redis
```

Copy `backend/.env.example` to `backend/.env` (or export the vars directly) if you want to
override the defaults — they already match this compose file.

**`JWT_SECRET`**: the `.env.example` default (`dev-secret-change-me`) is for local dev only —
anyone who can read it can forge login tokens. Generate a real random secret before running
this anywhere beyond your own machine, with any one of:

```
# Python (already required by the backend, works on any OS)
python -c "import secrets; print(secrets.token_hex(32))"

# PowerShell 5.1+ (Windows)
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join ""

# Git Bash / macOS / Linux, if openssl is installed
openssl rand -hex 32
```

Put the output in `backend/.env` as `JWT_SECRET=<generated value>` (or set it as a real
environment variable in production). Rotating it invalidates every issued token — everyone
gets logged out.

## 2. Backend setup

```
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# venv/bin/pip install -r requirements.txt       # macOS/Linux
./venv/Scripts/alembic upgrade head              # creates/updates the schema
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`. Two accounts are seeded automatically on
first run: `admin@cme.local` / `admin123` (role `admin`) and `staff@cme.local` / `staff123`
(role `staff`).

## 3. Frontend setup

```
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Status

See `CONTEXT.md` → **Status** for what's implemented, what's verified, and what's still open.
