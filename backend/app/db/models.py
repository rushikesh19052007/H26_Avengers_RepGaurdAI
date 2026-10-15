"""SQLAlchemy ORM models for DepGuard AI."""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class ScanRecord(Base):
    __tablename__ = "scans"

    id = Column(String(64), primary_key=True)
    repo_url = Column(String(512), nullable=True)
    repo_name = Column(String(256), nullable=True)
    branch = Column(String(128), default="main")
    commit_sha = Column(String(64), default="HEAD")
    status = Column(String(32), default="queued")  # queued, running, completed, failed
    current_stage = Column(String(128), default="Validating repository")
    progress_percent = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    stages_json = Column(Text, default="[]")
    summary_json = Column(Text, default="{}")
    ai_assessment = Column(Text, nullable=True)
    ai_model_used = Column(String(128), nullable=True)
    verification_summary_json = Column(Text, default="{}")
    limitations_json = Column(Text, default="[]")
    manifests_json = Column(Text, default="[]")
    scanned_files_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    dependencies = relationship("DependencyRecord", back_populates="scan", cascade="all, delete-orphan")
    facts = relationship("FactRecord", back_populates="scan", cascade="all, delete-orphan")
    test_runs = relationship("TestRunRecord", back_populates="scan", cascade="all, delete-orphan")
    comparisons = relationship("ComparisonRecord", back_populates="scan", cascade="all, delete-orphan")
    capsule = relationship("CapsuleRecord", back_populates="scan", uselist=False, cascade="all, delete-orphan")


class DependencyRecord(Base):
    __tablename__ = "dependencies"

    id = Column(String(128), primary_key=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    ecosystem = Column(String(32), default="pypi")
    version = Column(String(64), default="unpinned")
    target_version = Column(String(64), default="latest")
    risk_severity = Column(String(32), default="Low")  # Critical, High, Needs Review, Low
    risk_reason = Column(Text, default="")
    evidence_source = Column(String(256), default="")
    declared_manifest = Column(String(256), default="")
    line_number = Column(Integer, default=1)
    ast_call_sites = Column(Integer, default=0)
    ast_files = Column(Integer, default=0)
    status = Column(String(64), default="Not tested")  # Not tested, Verified, Failed, Gaps found
    status_details = Column(Text, default="")
    is_direct = Column(Boolean, default=True)
    is_dev = Column(Boolean, default=False)
    code_snippets_json = Column(Text, default="[]")
    ai_confidence = Column(Float, nullable=True)

    scan = relationship("ScanRecord", back_populates="dependencies")
    facts = relationship("FactRecord", back_populates="dependency", cascade="all, delete-orphan")
    migration_plan = relationship("MigrationPlanRecord", back_populates="dependency", uselist=False, cascade="all, delete-orphan")


class FactRecord(Base):
    __tablename__ = "facts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_id = Column(String(128), ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String(32), nullable=False)  # OBSERVED, REGISTRY, OSV, GITHUB, AI_RECOMMENDATION, VERIFIED
    text = Column(Text, nullable=False)
    is_warning = Column(Boolean, default=False)
    source = Column(String(256), nullable=True)
    source_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    scan = relationship("ScanRecord", back_populates="facts")
    dependency = relationship("DependencyRecord", back_populates="facts")


class MigrationPlanRecord(Base):
    __tablename__ = "migration_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dependency_id = Column(String(128), ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, unique=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(32), default="upgrade")  # replace, upgrade, remove, keep
    target_packages_json = Column(Text, default="[]")
    rationale = Column(Text, default="")
    migration_steps_json = Column(Text, default="[]")
    suggested_tests_json = Column(Text, default="[]")
    risks_json = Column(Text, default="[]")
    limitations_json = Column(Text, default="[]")
    unified_diff = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    gemma_model = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    dependency = relationship("DependencyRecord", back_populates="migration_plan")


class TestRunRecord(Base):
    __tablename__ = "test_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_id = Column(String(128), nullable=True, index=True)
    python_version = Column(String(16), nullable=False)  # 3.12, 3.13
    variant = Column(String(16), nullable=False)  # ORIGINAL, REPLACEMENT
    command = Column(String(256), nullable=False)
    exit_code = Column(Integer, nullable=True)
    passed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    errors = Column(Integer, default=0)
    duration = Column(Float, default=0.0)
    stdout_tail = Column(Text, default="")
    status = Column(String(32), default="skipped")  # passed, failed, error, skipped
    created_at = Column(DateTime, default=utcnow)

    scan = relationship("ScanRecord", back_populates="test_runs")


class ComparisonRecord(Base):
    __tablename__ = "comparisons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_id = Column(String(128), nullable=False, index=True)
    python_version = Column(String(16), nullable=False)
    install_ok_delta = Column(Boolean, default=True)
    import_ok_delta = Column(Boolean, default=True)
    passed_delta = Column(Integer, default=0)
    failed_delta = Column(Integer, default=0)
    duration_delta = Column(Float, default=0.0)
    newly_failing_tests_json = Column(Text, default="[]")
    newly_passing_tests_json = Column(Text, default="[]")
    compatibility_gaps_json = Column(Text, default="[]")
    unresolved_risks_json = Column(Text, default="[]")
    status = Column(String(64), default="Not tested")  # Verified-equivalent, Gaps found, Failed to apply, Not tested
    created_at = Column(DateTime, default=utcnow)

    scan = relationship("ScanRecord", back_populates="comparisons")


class RegistryCacheRecord(Base):
    __tablename__ = "registry_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ecosystem = Column(String(32), default="pypi")
    package_name = Column(String(128), nullable=False, index=True)
    data_json = Column(Text, nullable=False)
    cached_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (
        Index("idx_registry_pkg_eco", "package_name", "ecosystem"),
    )


class CapsuleRecord(Base):
    __tablename__ = "capsules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(64), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True)
    schema_version = Column(String(16), default="1.0.0")
    json_content = Column(Text, nullable=False)
    markdown_content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    scan = relationship("ScanRecord", back_populates="capsule")
