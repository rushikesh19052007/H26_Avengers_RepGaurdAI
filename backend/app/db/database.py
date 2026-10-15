"""Database configuration and session management for DepGuard AI."""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# Parse and normalize database URL
db_url = settings.database_url

if db_url.startswith("sqlite"):
    # Ensure local directory exists for SQLite
    if db_url.startswith("sqlite:///./"):
        rel_path = db_url.replace("sqlite:///./", "")
        db_path = Path(__file__).resolve().parent.parent.parent / rel_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        db_url = f"sqlite:///{db_path.as_posix()}"
    elif db_url.startswith("sqlite:////") or db_url.startswith("sqlite:///"):
        # Absolute path
        raw_path = db_url.replace("sqlite:///", "")
        Path(raw_path).parent.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False, "timeout": 30.0} if "sqlite" in db_url else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency for yielding a managed SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on application startup."""
    from app.db import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
