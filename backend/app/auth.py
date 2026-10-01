"""JWT authentication.

JWT_SECRET must be set via env var in any real deployment — the fallback
below is for local dev only.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.db_utils import row_to_dict
from app.redis_client import redis_client

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user: dict) -> str:
    payload = {
        "sub": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "jti": uuid.uuid4().hex,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def revoke_token(payload: dict) -> None:
    """Blocks a token for the remainder of its natural lifetime (logout)."""
    ttl = int(payload["exp"] - datetime.now(timezone.utc).timestamp())
    if ttl > 0:
        redis_client.setex(f"revoked_token:{payload['jti']}", ttl, "1")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if redis_client.exists(f"revoked_token:{payload['jti']}"):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user = db.query(models.User).filter_by(user_id=payload["sub"]).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return row_to_dict(user)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_staff(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "staff":
        raise HTTPException(status_code=403, detail="Staff access required")
    return current_user
