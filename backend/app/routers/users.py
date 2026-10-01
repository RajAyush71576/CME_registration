from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserUpdate
from ..security import hash_password, require_admin

router = APIRouter(prefix="/users", tags=["users"])


def user_out(user: User) -> dict:
    return {"user_id": user.user_id, "name": user.name, "email": user.email, "role": user.role,
            "is_active": user.is_active}


def email_taken(db: Session, email: str, exclude_id: str | None = None) -> bool:
    stmt = select(User.user_id).where(func.lower(User.email) == email.lower())
    if exclude_id:
        stmt = stmt.where(User.user_id != exclude_id)
    return db.scalar(stmt) is not None


@router.get("", dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.is_active.desc(), User.role, User.name))
    return [user_out(u) for u in users]


@router.post("", status_code=201, dependencies=[Depends(require_admin)])
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if email_taken(db, body.email):
        raise HTTPException(409, "An account with this email already exists")
    user = User(name=body.name, email=body.email.lower(), role=body.role, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    return user_out(user)


@router.patch("/{user_id}")
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), me: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if user.user_id == me.user_id and (changes.get("role", "admin") != "admin" or changes.get("is_active") is False):
        raise HTTPException(400, "You can't remove your own admin access or deactivate your own account")
    if "email" in changes:
        if email_taken(db, changes["email"], exclude_id=user.user_id):
            raise HTTPException(409, "An account with this email already exists")
        changes["email"] = changes["email"].lower()
    if "password" in changes:
        user.password_hash = hash_password(changes.pop("password"))
    for k, v in changes.items():
        setattr(user, k, v)
    db.commit()
    return user_out(user)
