"""Seeds a few staff accounts for local development/testing.

Real staff-account management (an admin "add user" flow) is out of scope for
now. This only runs when the Users sheet is empty, so it's a no-op once any
account exists.
"""

from app import excel_store as store
from app.auth import hash_password

SEED_USERS = [
    {"name": "Admin", "email": "admin@cme.local", "password": "admin123", "role": "admin"},
    {
        "name": "Registration Desk",
        "email": "desk@cme.local",
        "password": "desk123",
        "role": "registration_desk",
    },
    {
        "name": "Observer",
        "email": "observer@cme.local",
        "password": "observer123",
        "role": "observer",
    },
]


def seed_users() -> None:
    if store.list_rows("Users"):
        return
    for u in SEED_USERS:
        store.append_row(
            "Users",
            {
                "user_id": store.new_id(),
                "name": u["name"],
                "role": u["role"],
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
            },
        )
