"""SQLAlchemy engine & session factory."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base

from app.config import DATABASE_URL

# Use check_same_thread=False for SQLite with FastAPI async workers
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Session:  # type: ignore[misc]
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db  # type: ignore[misc]
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (idempotent)."""
    import app.db.models as _models  # noqa: F401 — ensure models are imported
    Base.metadata.create_all(bind=engine)
