import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app import models
from app.auth import (
    JWT_ALGORITHM,
    JWT_SECRET,
    bearer_scheme,
    create_access_token,
    get_current_user,
    revoke_token,
    verify_password,
)
from app.database import get_db
from app.redis_client import redis_client
from app.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_RATE_LIMIT = 10
LOGIN_RATE_WINDOW_SECONDS = 300


def _check_login_rate_limit(client_ip: str) -> None:
    key = f"login_attempts:{client_ip}"
    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, LOGIN_RATE_WINDOW_SECONDS)
    if count > LOGIN_RATE_LIMIT:
        raise HTTPException(
            status_code=429, detail="Too many login attempts — try again later"
        )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(client_ip)

    user = db.query(models.User).filter_by(email=payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        {"user_id": user.user_id, "email": user.email, "role": user.role}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user.user_id,
            "name": user.name,
            "role": user.role,
            "email": user.email,
        },
    }


@router.post("/logout", status_code=204)
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        payload = pyjwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    revoke_token(payload)


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return current_user
