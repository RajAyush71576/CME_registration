# CME Registration System

Registration, Excel import, tablet sign-in/sign-out with on-screen signatures, attendance tracking,
PDF certificates and an Excel attendance report for hospital CME events.
3–6 tablets at the venue all talk to one backend over the LAN.

- `backend/` — FastAPI + SQLAlchemy 2 + Alembic on PostgreSQL. Login rate limiting and logout token
  revocation are stored in Redis (both are short-lived, TTL'd data). Signatures and certificate PDFs
  are stored under `backend/data/`.
- `frontend/` — React 19 + Vite + Tailwind CSS v4.

## Docker (recommended)

Requires Docker Desktop running. From the project root:

```bash
docker compose up -d --build
```

This builds and starts Postgres, Redis, the backend (migrations run automatically on container start)
and the frontend dev server. Watch `docker compose logs backend` on first start — it prints the
seeded admin password (see below). Open `http://localhost:5173`; tablets on the same Wi-Fi open
`http://<this-computer's-LAN-IP>:5173` (find it with `ipconfig` / `ip addr`). On Windows, allow ports
5173 and 8000 through the firewall for private networks.

Override `JWT_SECRET` and `ADMIN_PASSWORD` via a `.env` file next to `docker-compose.yml` (or exported
env vars) before the first `up` anywhere other than your own machine. Data persists in named Docker
volumes (`postgres_data`, `redis_data`, `backend_data`) across restarts; `docker compose down -v` wipes
them.

## Manual setup (without Docker)

### 1. PostgreSQL

Install PostgreSQL locally (Windows: [postgresql.org installer](https://www.postgresql.org/download/windows/)),
then as a superuser run `backend/setup.sql` to create the `cme` role and `cme_registration` database:

```bash
psql -U postgres -f backend/setup.sql
```

### 2. Redis

Redis has no official Windows build. Easiest options, in order of convenience:
- Run just the Redis container: `docker compose up -d redis` (needs Docker Desktop, nothing else).
- Install [Memurai](https://www.memurai.com/) (a native Windows-compatible Redis server).
- Run Redis inside WSL2 (`sudo apt install redis-server && redis-server`).

On macOS/Linux, install Redis with your package manager (`brew install redis`, `apt install redis-server`, …)
and start it (`redis-server`).

Either way, make sure it's reachable at `REDIS_URL` (default `redis://localhost:6379/0`).

### 3. Backend

```bash
cd backend
python -m venv venv
# Windows (PowerShell):  .\venv\Scripts\Activate.ps1
# macOS / Linux:         source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Configuration comes from environment variables (defaults shown in `backend/.env.example`):
`DATABASE_URL` (default `postgresql+psycopg://cme:cme_dev_password@localhost:5432/cme_registration`),
`REDIS_URL` (default `redis://localhost:6379/0`) and `JWT_SECRET`. Set a real `JWT_SECRET` anywhere
other than your own machine.

On first start, if the users table is empty, an admin account is created (email `admin@cme.local`,
password from `ADMIN_PASSWORD` or a random one printed once in the startup logs — change it after
logging in).

Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`. API docs: `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd frontend
npm install && npm run dev
```

Open `http://localhost:5173`. Vite listens on all interfaces, so tablets on the same Wi-Fi open
`http://<this-computer's-LAN-IP>:5173` (find it with `ipconfig` / `ip addr`). The frontend calls the
API on the same host at port 8000; override with `VITE_API_URL` if the backend lives elsewhere.
On Windows, allow ports 5173 and 8000 through the firewall for private networks.

### Stopping

Ctrl+C both the `uvicorn` and `npm run dev` processes. PostgreSQL/Redis keep running as background
services until you stop them yourself (service manager, or `docker compose stop redis` if you used the
Redis container option above).

## How the day works

1. **Admin** creates the event (date, start time, duration, CME credits) and imports the registration
   sheet (Import → download the template, fill it, upload, fix rows in the review table, import).
2. **Staff** on tablets open the event, tap a participant and use **Sign In** — available only on the
   event day (Asia/Kolkata time) from the start time. Walk-ins are added with **+ New Participant**.
3. **Sign Out** unlocks once the participant has been signed in for the event's approximate duration.
4. **Admin** issues certificates (numbered 001, 002… per event) and downloads the attendance report.
5. **Admin** closes the event; anyone without attendance then shows as Absent.

Events with CME credits require a medical license number for registration and certificates.
