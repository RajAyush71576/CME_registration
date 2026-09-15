# CME_registration
Creating a web application for registration and record attendance of CME participants for Amrita hospital and its events.

See `CONTEXT.md` for the full functional requirements and architecture (including current
implementation status), and `docs/excel-schema.md` for the original workbook design (now
historical — Postgres is the live data store; Excel is import/export-only).

## Project layout

- `frontend/` — React + Vite + Tailwind CSS
- `backend/` — Python + FastAPI + SQLAlchemy + Alembic
- `docs/` — design docs
- `docker-compose.yml` — full stack: Postgres + Redis + backend + frontend

## Quick start (Docker)

The whole stack — Postgres, Redis, backend API, and frontend — starts with one command from
the repo root:

```
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000` (health check: `GET /health`)

The backend container runs `alembic upgrade head` automatically before starting, so the schema
is always up to date. Two accounts are seeded automatically on first run: `admin@cme.local` /
`admin123` (role `admin`) and `staff@cme.local` / `staff123` (role `staff`).

Add `-d` to run in the background, and stop everything with `docker compose down` (add `-v` to
also wipe the Postgres/signatures volumes).

**`JWT_SECRET`**: the built-in default (`dev-secret-change-me`) is for local dev only — anyone
who can read it can forge login tokens. For anything beyond your own machine, generate a real
secret and set it before starting the stack:

```
# Python (already required by the backend, works on any OS)
python -c "import secrets; print(secrets.token_hex(32))"

# PowerShell 5.1+ (Windows)
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join ""

# Git Bash / macOS / Linux, if openssl is installed
openssl rand -hex 32
```

Then either export it before running compose (`$env:JWT_SECRET = "<value>"` on PowerShell, or
`export JWT_SECRET=<value>` on bash) or put `JWT_SECRET=<value>` in a `.env` file next to
`docker-compose.yml` — compose picks it up automatically. Rotating it invalidates every issued
token — everyone gets logged out.

## Local development without Docker

Prefer this if you want hot-reload on the backend/frontend while only Postgres and Redis run
in containers.

### 1. Start infrastructure (Postgres + Redis)

```
docker compose up -d postgres redis
```

### 2. Backend setup

```
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# venv/bin/pip install -r requirements.txt       # macOS/Linux
./venv/Scripts/alembic upgrade head              # creates/updates the schema
./venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend setup

```
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Status

See `CONTEXT.md` → **Status** for what's implemented, what's verified, and what's still open.
