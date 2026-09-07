"""Seeds a few staff accounts for local development/testing.

Real staff-account management (an admin "add user" flow) is out of scope for
now. This only runs when the users table is empty, so it's a no-op once any
account exists.
"""

from sqlalchemy.orm import Session

from app import models
from app.auth import hash_password

SEED_USERS = [
    {"name": "Admin", "email": "admin@cme.local", "password": "admin123", "role": "admin"},
    {"name": "Staff", "email": "staff@cme.local", "password": "staff123", "role": "staff"},
]


def seed_users(db: Session) -> None:
    if db.query(models.User).first():
        return
    for u in SEED_USERS:
        db.add(
            models.User(
                name=u["name"],
                role=u["role"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
            )
        )
    db.commit()
