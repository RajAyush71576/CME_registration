import hashlib
import time
import uuid

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import JWT_SECRET, get_db
from .models import User
from .redis_ops import is_revoked

TOKEN_TTL_SECONDS = 12 * 3600
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode()
    return len(raw) <= 72 and bcrypt.checkpw(raw, password_hash.encode())  # bcrypt raises past 72 bytes


def password_fingerprint(user: User) -> str:
    """Changes whenever the password does, so a password reset invalidates every older token."""
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def create_token(user: User) -> str:
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "role": user.role,
        "pwh": password_fingerprint(user),
        "jti": uuid.uuid4().hex,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_live_ticket(payload: dict) -> str:
    """Token for the /live stream only (it travels in the URL, so it must not work as an API token).
    Shares the session's jti and expiry, so logging out revokes it too."""
    return jwt.encode({**payload, "typ": "live"}, JWT_SECRET, algorithm="HS256")


def _unauthorized(detail="Not authenticated"):
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def decode_token(token: str, typ: str | None = None) -> dict:
    """typ=None accepts only normal API tokens; typ="live" only /live tickets."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token")
    if payload.get("typ") != typ:
        raise _unauthorized("Invalid or expired token")
    if is_revoked(payload.get("jti")):
        raise _unauthorized("Token has been revoked")
    return payload


def get_token_payload(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not creds:
        raise _unauthorized()
    return decode_token(creds.credentials)


def user_for_payload(db: Session, payload: dict) -> User:
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise _unauthorized()
    if payload.get("pwh") != password_fingerprint(user):
        raise _unauthorized("Your password was changed — please log in again")
    return user


def get_current_user(payload: dict = Depends(get_token_payload), db: Session = Depends(get_db)) -> User:
    return user_for_payload(db, payload)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
