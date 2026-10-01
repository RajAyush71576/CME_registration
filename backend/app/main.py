import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from . import live
from .db import CERTIFICATES_DIR, SIGNATURES_DIR, SessionLocal
from .models import User
from .routers import attendance, auth, certificates, events, imports, participants, registrations, reports, users
from .security import decode_token, hash_password, user_for_payload

SEED_ADMIN_EMAIL = "admin@cme.local"


@asynccontextmanager
async def lifespan(app: FastAPI):
    live.bind_loop()
    SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
    CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)) == 0:
            # First start: one admin, password from ADMIN_PASSWORD or a random one shown once here.
            password = os.getenv("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
            db.add(User(name="Admin", role="admin", email=SEED_ADMIN_EMAIL, password_hash=hash_password(password)))
            db.commit()
            if not os.getenv("ADMIN_PASSWORD"):
                print(f"Created first admin: {SEED_ADMIN_EMAIL} / {password} — change it after logging in.", flush=True)
    yield


app = FastAPI(title="CME Registration System", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # This machine plus private LAN addresses (venue tablets), on the Vite dev / preview ports.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}):(5173|4173)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (auth, users, events, participants, registrations, attendance, certificates, imports, reports):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/live")
def live_updates(token: str = Query(...)):
    """Server-Sent Events stream of "something changed" pings. EventSource can't send headers, so the
    token comes in the query string — a live-only ticket from POST /auth/live-ticket, never the API token.
    It's checked once, then the DB session is released."""
    with SessionLocal() as db:
        user_for_payload(db, decode_token(token, typ="live"))
    return StreamingResponse(
        live.stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
