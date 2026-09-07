"""SQLAlchemy engine/session setup.

DATABASE_URL must be set via env var in any real deployment — the fallback
below points at the local docker-compose Postgres service (see
docker-compose.yml at the repo root).
"""

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg2://cme:cme_dev_password@localhost:5432/cme_registration"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
