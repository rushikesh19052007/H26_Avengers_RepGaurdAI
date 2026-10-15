"""Database persistence package for DepGuard AI."""
from app.db.database import Base, engine, SessionLocal, get_db, init_db
from app.db.models import (
    ScanRecord,
    DependencyRecord,
    FactRecord,
    MigrationPlanRecord,
    TestRunRecord,
    ComparisonRecord,
    RegistryCacheRecord,
    CapsuleRecord,
)

__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "init_db",
    "ScanRecord",
    "DependencyRecord",
    "FactRecord",
    "MigrationPlanRecord",
    "TestRunRecord",
    "ComparisonRecord",
    "RegistryCacheRecord",
    "CapsuleRecord",
]
