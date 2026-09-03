# CME_registration
Creating a web application for registration and record attendance of CME participants for Amrita hospital and its events.

See `CONTEXT.md` for the full functional requirements and architecture, and
`docs/excel-schema.md` for the central Excel workbook design.

## Project layout

- `frontend/` — React + Vite + Tailwind CSS
- `backend/` — Python + FastAPI
- `docs/` — design docs

## Backend setup

```
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# venv/bin/pip install -r requirements.txt       # macOS/Linux
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Frontend setup

```
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Status

Bare scaffold only — no business logic implemented yet. See `CONTEXT.md` §17 for the
planned development order.
