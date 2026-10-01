import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://cme:cme_dev_password@localhost:5432/cme_registration"
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _jwt_secret() -> str:
    """JWT_SECRET from env; otherwise a random one generated on first start and kept in data/.jwt_secret."""
    if os.getenv("JWT_SECRET"):
        return os.environ["JWT_SECRET"]
    path = DATA_DIR / ".jwt_secret"
    if not path.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(48))
    return path.read_text().strip()


JWT_SECRET = _jwt_secret()
SIGNATURES_DIR = DATA_DIR / "signatures"
CERTIFICATES_DIR = DATA_DIR / "certificates"

IST = ZoneInfo("Asia/Kolkata")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def fmt_ist(dt, fmt="%d %b %Y, %I:%M %p") -> str:
    return dt.astimezone(IST).strftime(fmt) if dt else ""
