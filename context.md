# Context: MySQL → PostgreSQL + Redis, and containerization

This file records *why* the stack looks the way it does, for whoever picks this project up next.
Day-to-day setup/run instructions are in `README.md`; this is the background.

## Original stack

The project started on MySQL/MariaDB (e.g. the one bundled with XAMPP), no Docker. Login rate
limiting and logout token revocation were stored in two MySQL tables (`login_attempts`,
`revoked_tokens`), written to with a MySQL-specific `INSERT ... ON DUPLICATE KEY UPDATE` upsert.

## Why it changed

The dev machine had no MySQL/MariaDB install at all (no XAMPP, no service, nothing on PATH), so the
project couldn't be run as documented. Rather than reinstalling XAMPP, the decision was to move to
PostgreSQL + Redis, both run via Docker, so the whole stack (app + its data services) is reproducible
on any machine with just Docker installed.

## What changed

**Database: MySQL → PostgreSQL**
- `backend/app/db.py` — default `DATABASE_URL` now `postgresql+psycopg://...`, driver is `psycopg[binary]`
  (pure-wheel, no system libpq needed) instead of `PyMySQL`.
- `backend/app/models.py` — `users.is_active` boolean server_default changed from `sa.text("1")` to
  `sa.text("true")`. MySQL silently accepts an integer literal as a boolean DEFAULT; Postgres does not
  (no implicit int→boolean cast), so this would have failed on first migration against real Postgres.
  Verified by compiling the DDL with SQLAlchemy's postgres dialect before running it for real.
- `backend/alembic/versions/0002_staff_accounts.py` — same boolean-default fix, since it adds the column.
- All other migrations (0001, 0003–0005) were already dialect-portable (no raw SQL, no MySQL-only types)
  and applied against Postgres with no changes.
- `backend/setup.sql` — rewritten for `psql`/Postgres role+database creation instead of MySQL grants.

**Rate limiting & token revocation: MySQL tables → Redis**
- Both were already short-lived, TTL'd data (a 5-minute sliding window counter; a revoked-token flag
  that only needs to live until the JWT's own `exp`) — a natural fit for Redis, and it removes the
  MySQL-only upsert SQL that wouldn't have ported to Postgres anyway.
- New `backend/app/redis_ops.py`: `count_attempt(key)` (atomic `INCR` + `EXPIRE NX` fixed window),
  `revoke_token(jti, exp)` (`SETEX` for the remaining token lifetime), `is_revoked(jti)`.
- `backend/app/models.py` — `LoginAttempt` and `RevokedToken` ORM models removed.
- `backend/alembic/versions/0006_drop_login_attempts_revoked_tokens.py` — drops the now-unused tables
  (reversible: `downgrade()` recreates them).
- `backend/app/security.py` — `decode_token()` no longer takes a `db: Session` (it checked
  `RevokedToken` via the DB before; now checks Redis via `is_revoked()`). `get_token_payload()` lost its
  now-unused `db` dependency too.
- `backend/app/routers/auth.py` — `login()`/`logout()` rewritten against `redis_ops` instead of the ORM;
  the MySQL-dialect `insert(...).on_duplicate_key_update(...)` import is gone.
- `backend/app/main.py` — the one other call site of `decode_token()` (the `/live` SSE ticket check)
  updated to the new signature.

**Containerization**
- `backend/Dockerfile` — `python:3.11-slim`, installs `requirements.txt`, runs
  `alembic upgrade head && uvicorn app.main:app` as the container command (migrations run automatically
  on every start — safe/idempotent since Alembic no-ops once a revision is already applied).
- `frontend/Dockerfile` — `node:20-alpine`, runs `npm run dev` (Vite dev server; `vite.config.js`
  already binds `0.0.0.0` so it's reachable from outside the container unmodified).
- `docker-compose.yml` (project root) — `postgres` (16-alpine), `redis` (7-alpine), `backend`, `frontend`.
  Postgres/Redis have healthchecks; `backend` waits on both via `depends_on: condition: service_healthy`.
  Named volumes: `postgres_data`, `redis_data`, `backend_data` (the latter mounted at `/app/data` —
  signatures, certificate PDFs, and the auto-generated `.jwt_secret` all live there and survive restarts).
- `backend/.dockerignore`, `frontend/.dockerignore` — keep `venv/`, `node_modules/`, `data/`, `dist/` out
  of build contexts.
- `backend/.env.example` — updated for `DATABASE_URL`/`REDIS_URL` defaults.

## Verified (2026-10-01)

- `docker compose build` — both images build clean.
- `docker compose up -d` — all four containers start; Alembic runs all 6 migrations against a fresh
  Postgres with no errors (confirms the boolean-default fix was necessary and correct).
- Backend seeds the first admin account on empty `users` table, as before.
- `POST /auth/login` → Redis keys `login_attempts:<ip>` / `login_attempts:acct:<hash>` appear with TTLs.
- `POST /auth/logout` → Redis key `revoked_tokens:<jti>` appears; a subsequent request with that token
  correctly gets `401 Token has been revoked`.
- Full login flow exercised through the actual browser UI (not just curl) against the frontend dev
  container — admin dashboard loads correctly end to end.

## Things to know if you touch this again

- `psycopg` (v3) is used, not `psycopg2` — different import name if you ever write raw driver code.
- The `JSON` column type (`Event.organizing_doctors`) and all `Numeric`/`Date`/`Time` types used in
  models/migrations are dialect-generic; no Postgres-specific follow-up needed there.
- If you add any new "upsert" or dialect-specific SQL, check it against Postgres explicitly — MySQL and
  Postgres diverge on upserts (`ON DUPLICATE KEY UPDATE` vs. `ON CONFLICT DO UPDATE`), boolean literals,
  and a few other DDL defaults.
- The frontend container runs the **dev** server (`npm run dev`), matching the project's pre-Docker
  workflow. For an actual production deployment, build static assets (`npm run build`) and serve them
  with something like nginx instead — the current `frontend/Dockerfile` is dev-oriented by design.
