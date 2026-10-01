import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..redis_ops import count_attempt, revoke_token
from ..schemas import LoginIn
from ..security import create_live_ticket, create_token, get_current_user, get_token_payload, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_ATTEMPTS = 10


def public_user(user: User) -> dict:
    return {"user_id": user.user_id, "name": user.name, "role": user.role, "email": user.email}


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    # Per IP and per account, so neither a shared NAT nor one targeted account can be brute-forced freely.
    ip_count = count_attempt(request.client.host if request.client else "unknown")
    acct_count = count_attempt("acct:" + hashlib.sha256(body.email.lower().encode()).hexdigest()[:40])
    if max(ip_count, acct_count) > MAX_ATTEMPTS:
        raise HTTPException(429, "Too many login attempts — try again in a few minutes")
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated — contact an admin")
    return {"access_token": create_token(user), "token_type": "bearer", "user": public_user(user)}


@router.post("/logout", status_code=204)
def logout(payload: dict = Depends(get_token_payload)):
    revoke_token(payload["jti"], payload["exp"])
    return Response(status_code=204)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return public_user(user)


@router.post("/live-ticket")
def live_ticket(payload: dict = Depends(get_token_payload), user: User = Depends(get_current_user)):
    """Ticket for GET /live?token=… — URLs end up in logs, so the real API token never goes there."""
    return {"ticket": create_live_ticket(payload)}
