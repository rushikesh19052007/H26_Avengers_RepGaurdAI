"""Pydantic schemas for DepGuard AI."""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Health Schemas
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    service: str = "DepGuard AI"
    model: str
    fallback_model: str
    thinking_level: str
    api_key_configured: bool
    environment: str


# ---------------------------------------------------------------------------
# Repository Validation Schemas
# ---------------------------------------------------------------------------
class RepositoryValidateRequest(BaseModel):
    repo_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None


class RepositoryValidateResponse(BaseModel):
    valid: bool
    repo_type: Optional[Literal["github", "zip"]] = None
    owner: Optional[str] = None
    repo_name: Optional[str] = None
    resolved_url: Optional[str] = None
    errors: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Scan Initiation & Progress Schemas
# ---------------------------------------------------------------------------
class ScanCreateRequest(BaseModel):
    repo_url: Optional[str] = None
    branch: Optional[str] = None


class ScanProgressStage(BaseModel):
    id: str
    name: str
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    details: Optional[str] = None
    completed_at: Optional[str] = None


class ScanStatusResponse(BaseModel):
    scan_id: str
    status: Literal["queued", "running", "completed", "failed"]
    current_stage: str
    progress_percent: int
    stages: List[ScanProgressStage]
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Evidence & AST Schemas
# ---------------------------------------------------------------------------
class RiskFact(BaseModel):
    type: Literal["OBSERVED", "INFERRED", "UNRESOLVED"]
    text: str
    isWarning: bool = False
    source: Optional[str] = None


class CodeSnippet(BaseModel):
    file: str
    line: int
    purpose: str
    code: str


class DiffSnippet(BaseModel):
    original: str
    replacement: str


class MigrationRecommendation(BaseModel):
    title: str
    targetPackages: List[str] = Field(default_factory=list)
    description: str
    confidence: float = 0.95
    estimatedSynthesisTime: str = "1.2s"
    astTransformAvailable: bool = True
    diffSnippet: DiffSnippet


# ---------------------------------------------------------------------------
# Gemma 4 AI Analysis Schemas (Strict Structured Output)
# ---------------------------------------------------------------------------
class GemmaFinding(BaseModel):
    package_name: str
    risk_level: Literal["critical", "high", "medium", "low", "unknown"]
    risk_category: Literal["maintenance", "compatibility", "deprecation", "ecosystem", "other"]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str] = Field(default_factory=list)
    affected_files: List[str] = Field(default_factory=list)
    reasoning_summary: str
    replacement_candidates: List[str] = Field(default_factory=list)
    migration_steps: List[str] = Field(default_factory=list)
    verification_requirements: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class GemmaAnalysisResponse(BaseModel):
    summary: str
    findings: List[GemmaFinding] = Field(default_factory=list)
    overall_assessment: str
    unresolved_questions: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Scanned Dependency Item
# ---------------------------------------------------------------------------
class DiscoveredDependency(BaseModel):
    id: str
    name: str
    ecosystem: str = "pypi"
    version: str
    targetVersion: Optional[str] = None
    riskSeverity: Literal["High", "Needs Review", "Low"]
    riskReason: str
    evidenceSource: str
    declaredManifest: str
    astCallSites: int = 0
    astFiles: int = 0
    status: Literal["Verified", "Failed", "Not tested"] = "Not tested"
    statusDetails: Optional[str] = None
    codeSnippets: List[CodeSnippet] = Field(default_factory=list)
    facts: List[RiskFact] = Field(default_factory=list)
    migrationRecommendation: Optional[MigrationRecommendation] = None
    aiConfidence: Optional[float] = None
    isDirect: bool = True


class ScanSummary(BaseModel):
    total: int
    highRisk: int
    needsReview: int
    healthy: int
    astCallSites: int
    scannedFilesCount: int
    verifiedPassing: int


# ---------------------------------------------------------------------------
# Scan Results & Capsule Schemas
# ---------------------------------------------------------------------------
class ScanResultsResponse(BaseModel):
    scan_id: str
    repository_name: str
    repository_url: str
    branch: str
    commit_sha: Optional[str] = None
    scan_timestamp: str
    manifests_discovered: List[str] = Field(default_factory=list)
    scanned_files_count: int
    dependencies: List[DiscoveredDependency] = Field(default_factory=list)
    summary: ScanSummary
    ai_assessment: Optional[str] = None
    ai_model_used: Optional[str] = None
    verification_summary: Dict[str, Any] = Field(default_factory=dict)
    limitations: List[str] = Field(default_factory=list)


class VerificationResponse(BaseModel):
    scan_id: str
    test_framework: str
    executed_command: Optional[str] = None
    exit_code: Optional[int] = None
    duration_seconds: float = 0.0
    status: Literal["passed", "failed", "skipped"]
    stdout_summary: str
    compatibility_gaps: List[str] = Field(default_factory=list)
    sandbox_isolated: bool = True
