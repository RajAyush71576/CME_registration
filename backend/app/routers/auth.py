from fastapi import APIRouter, Depends, HTTPException

from app import excel_store as store
from app.auth import create_access_token, get_current_user, verify_password
from app.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    user = next(
        (u for u in store.list_rows("Users") if u["email"] == payload.email), None
    )
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "role": user["role"],
            "email": user["email"],
        },
    }


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return current_user
