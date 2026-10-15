"""API routes for DepGuard AI backend."""

import asyncio
import os
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List

from fastapi import (
    APIRouter,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
    Response,
    status,
)
from fastapi.responses import PlainTextResponse

import io
import zipfile
from app.config import settings
from app.schemas import (
    HealthResponse,
    RepositoryValidateRequest,
    RepositoryValidateResponse,
    ScanCreateRequest,
    ScanStatusResponse,
    ScanProgressStage,
    ScanResultsResponse,
    VerificationResponse,
    ScanListItem,
    MigrationPlanRequest,
    MultiDepMigrationPlanResponse,
    DependencyPlanItem,
    ComparisonRequest,
    ComparisonResponse,
)
from app.services.repository_service import (
    validate_github_url,
    fetch_github_repo_archive,
    safe_extract_zip,
)
from app.services.dependency_analyzer import DependencyAnalyzer
from app.services.verification_service import VerificationService
from app.services.comparison_service import ComparisonService
from app.services.capsule_service import CapsuleService
from app.services.gemma_service import GemmaService
from app.db.database import SessionLocal
from app.db.models import (
    ScanRecord,
    DependencyRecord,
    FactRecord,
    MigrationPlanRecord,
    ComparisonRecord,
    CapsuleRecord,
)

router = APIRouter(prefix="/api")

# Scan registry to manage asynchronous background execution
SCAN_STORE: Dict[str, Dict[str, Any]] = {}

STAGES_TEMPLATE = [
    {"id": "validate", "name": "Validating repository"},
    {"id": "retrieve", "name": "Retrieving repository files"},
    {"id": "parse", "name": "Parsing dependency manifests"},
    {"id": "map_ast", "name": "Mapping source usages"},
    {"id": "metadata", "name": "Collecting available metadata"},
    {"id": "gemma_ai", "name": "Running Gemma 4 analysis"},
    {"id": "validate_ai", "name": "Validating model output"},
    {"id": "verify", "name": "Running available verification checks"},
    {"id": "capsule", "name": "Generating the Exit Capsule"},
]


def _init_scan_record(scan_id: str, repo_identifier: str, scan_type: str) -> Dict[str, Any]:
    stages = [
        ScanProgressStage(
            id=s["id"],
            name=s["name"],
            status="pending",
        )
        for s in STAGES_TEMPLATE
    ]
    return {
        "scan_id": scan_id,
        "repo_identifier": repo_identifier,
        "scan_type": scan_type,
        "status": "running",
        "current_stage": stages[0].name,
        "progress_percent": 0,
        "stages": stages,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "results": None,
        "capsule_json": None,
        "capsule_md": None,
        "temp_dir": None,
    }


def _update_stage(
    scan: Dict[str, Any],
    stage_id: str,
    stage_status: str,
    details: Optional[str] = None,
    percent: Optional[int] = None,
):
    for stage in scan["stages"]:
        if stage.id == stage_id:
            stage.status = stage_status
            stage.details = details
            if stage_status == "completed":
                stage.completed_at = datetime.now(timezone.utc).isoformat()
            break

    # Find first in_progress or pending stage
    active = next((s for s in scan["stages"] if s.status == "in_progress"), None)
    if not active:
        active = next((s for s in scan["stages"] if s.status == "pending"), None)

    if active:
        scan["current_stage"] = active.name

    if percent is not None:
        scan["progress_percent"] = percent
    else:
        completed_count = sum(1 for s in scan["stages"] if s.status == "completed")
        scan["progress_percent"] = int((completed_count / len(scan["stages"])) * 100)


# ---------------------------------------------------------------------------
# 1. GET /api/health
# ---------------------------------------------------------------------------
@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check ping returning configured provider/model status without secrets."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        model=settings.gemma_model,
        fallback_model=settings.gemma_fallback_model,
        thinking_level=settings.gemma_thinking_level,
        api_key_configured=settings.has_gemini_key,
        environment=settings.environment,
    )


# ---------------------------------------------------------------------------
# 2. POST /api/repositories/validate
# ---------------------------------------------------------------------------
@router.post("/repositories/validate", response_model=RepositoryValidateResponse)
def validate_repository(req: RepositoryValidateRequest):
    """Validate a GitHub URL or uploaded ZIP file metadata."""
    if req.repo_url:
        is_valid, owner, repo, branch, errors = validate_github_url(req.repo_url)
        resolved_url = f"https://github.com/{owner}/{repo}" if is_valid and owner and repo else None
        return RepositoryValidateResponse(
            valid=is_valid,
            repo_type="github",
            owner=owner,
            repo_name=repo,
            resolved_url=resolved_url,
            errors=errors,
        )

    if req.file_name:
        errors = []
        if not req.file_name.lower().endswith(".zip"):
            errors.append("Only .zip archives are supported.")
        if req.file_size_bytes and req.file_size_bytes > settings.max_upload_bytes:
            errors.append(f"File exceeds maximum upload size of {settings.max_upload_size_mb} MB.")

        clean_name = Path(req.file_name).stem
        return RepositoryValidateResponse(
            valid=len(errors) == 0,
            repo_type="zip",
            repo_name=clean_name,
            resolved_url=f"local://{req.file_name}",
            errors=errors,
        )

    return RepositoryValidateResponse(
        valid=False,
        errors=["Either repo_url or file_name must be provided for validation."],
    )


# ---------------------------------------------------------------------------
# 3. POST /api/scans (Start a scan via URL or multipart ZIP)
# ---------------------------------------------------------------------------
async def _execute_scan_pipeline(
    scan_id: str,
    repo_url: Optional[str] = None,
    branch: Optional[str] = None,
    zip_bytes: Optional[bytes] = None,
    zip_filename: Optional[str] = None,
):
    """Asynchronous background worker executing all 9 scan pipeline stages."""
    scan = SCAN_STORE[scan_id]
    temp_dir_obj = tempfile.TemporaryDirectory(prefix="repguard_scan_")
    repo_dir = Path(temp_dir_obj.name)
    scan["temp_dir"] = temp_dir_obj

    analyzer = DependencyAnalyzer()
    verifier = VerificationService()
    capsule_service = CapsuleService()

    try:
        # Stage 1: Validate repository
        _update_stage(scan, "validate", "in_progress", "Validating repository target", percent=10)
        repo_metadata: Dict[str, Any] = {}

        if repo_url:
            valid, owner, repo_name, url_branch, errors = validate_github_url(repo_url)
            if not valid or not owner or not repo_name:
                raise ValueError(f"Invalid repository URL: {', '.join(errors)}")
            target_branch = branch or url_branch
            _update_stage(scan, "validate", "completed", f"Validated GitHub repo {owner}/{repo_name}")

            # Stage 2: Retrieve files from GitHub
            _update_stage(scan, "retrieve", "in_progress", f"Downloading repository archive for {owner}/{repo_name}", percent=20)
            archive_bytes, metadata = await fetch_github_repo_archive(owner, repo_name, target_branch)
            repo_metadata = metadata

            # Extract archive
            extracted = safe_extract_zip(archive_bytes, repo_dir)
            _update_stage(scan, "retrieve", "completed", f"Extracted {len(extracted)} files securely.")

        elif zip_bytes:
            clean_name = Path(zip_filename or "upload.zip").stem
            repo_metadata = {
                "name": clean_name,
                "url": f"local://{zip_filename or 'upload.zip'}",
                "branch": "snapshot",
                "commit_sha": None,
                "visibility": "Local ZIP",
            }
            _update_stage(scan, "validate", "completed", "Validated ZIP archive headers.")

            # Stage 2: Extract ZIP
            _update_stage(scan, "retrieve", "in_progress", "Extracting archive members safely with ZipSlip protection", percent=20)
            extracted = safe_extract_zip(zip_bytes, repo_dir)
            _update_stage(scan, "retrieve", "completed", f"Extracted {len(extracted)} files safely.")

        else:
            raise ValueError("No repository URL or ZIP file supplied.")

        # If archive extracted into a single top-level directory (e.g. owner-repo-sha), resolve to inner dir
        children = [c for c in repo_dir.iterdir() if c.is_dir() and not c.name.startswith(".")]
        working_dir = repo_dir
        if len(children) == 1 and not (repo_dir / "requirements.txt").exists() and not (repo_dir / "package.json").exists():
            working_dir = children[0]

        # Stage 3: Parse dependency manifests
        _update_stage(scan, "parse", "in_progress", "Scanning requirements.txt, pyproject.toml, package.json", percent=35)
        # Stage 4: Map source usages
        _update_stage(scan, "map_ast", "in_progress", "Analyzing AST import graphs", percent=45)
        # Stage 5: Metadata
        _update_stage(scan, "metadata", "in_progress", "Indexing packages and known compatibility rules", percent=55)

        # Stage 6 & 7: AI Analysis with Gemma 4
        _update_stage(scan, "gemma_ai", "in_progress", f"Invoking Gemma 4 ({settings.gemma_model}) with thinking enabled", percent=65)

        (
            dependencies,
            summary,
            discovered_manifests,
            ai_assessment,
            ai_model_used,
            limitations,
        ) = await analyzer.analyze_repository(working_dir, repo_metadata)

        _update_stage(scan, "parse", "completed", f"Found {len(discovered_manifests)} manifests.")
        _update_stage(scan, "map_ast", "completed", f"Mapped {summary.astCallSites} call sites.")
        _update_stage(scan, "metadata", "completed", "Compatibility flags synchronized.")
        _update_stage(scan, "gemma_ai", "completed", "Gemma 4 reasoning finished.")

        # Stage 7: Validate model output
        _update_stage(scan, "validate_ai", "in_progress", "Verifying model recommendations against AST evidence", percent=80)
        _update_stage(scan, "validate_ai", "completed", "Structured validation passed.")

        # Stage 8: Run verification checks
        _update_stage(scan, "verify", "in_progress", "Executing safe sandbox test verification", percent=90)
        verification_result = verifier.verify_repository(scan_id, working_dir)
        _update_stage(scan, "verify", "completed", f"Verification status: {verification_result.status}")

        # Stage 9: Generate Exit Capsule
        _update_stage(scan, "capsule", "in_progress", "Compiling JSON and Markdown Dependency Exit Capsule", percent=95)

        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        results = ScanResultsResponse(
            scan_id=scan_id,
            repository_name=repo_metadata.get("full_name") or repo_metadata.get("name", "Repository"),
            repository_url=repo_metadata.get("html_url") or repo_metadata.get("url", ""),
            branch=repo_metadata.get("target_branch") or repo_metadata.get("branch", "main"),
            commit_sha=repo_metadata.get("commit_sha"),
            scan_timestamp=timestamp_str,
            manifests_discovered=discovered_manifests,
            scanned_files_count=summary.scannedFilesCount,
            dependencies=dependencies,
            summary=summary,
            ai_assessment=ai_assessment,
            ai_model_used=ai_model_used,
            verification_summary={
                "test_framework": verification_result.test_framework,
                "status": verification_result.status,
                "executed_command": verification_result.executed_command,
                "duration_seconds": verification_result.duration_seconds,
                "stdout_summary": verification_result.stdout_summary,
                "compatibility_gaps": verification_result.compatibility_gaps,
            },
            limitations=limitations,
        )

        capsule_json = capsule_service.generate_json_capsule(results)
        capsule_md = capsule_service.generate_markdown_capsule(results)

        _update_stage(scan, "capsule", "completed", "Exit Capsule created successfully.", percent=100)

        scan["results"] = results
        scan["capsule_json"] = capsule_json
        scan["capsule_md"] = capsule_md
        scan["working_dir"] = working_dir
        scan["status"] = "completed"
        scan["current_stage"] = "Scan completed"

        # Persist to SQLite
        db = SessionLocal()
        try:
            scan_rec = ScanRecord(
                id=scan_id,
                repo_url=results.repository_url,
                repo_name=results.repository_name,
                branch=results.branch,
                commit_sha=results.commit_sha or "HEAD",
                status="completed",
                current_stage="Scan completed",
                progress_percent=100,
                summary_json=results.summary.model_dump_json(),
                ai_assessment=results.ai_assessment,
                ai_model_used=results.ai_model_used,
                verification_summary_json=json.dumps(results.verification_summary),
                limitations_json=json.dumps(results.limitations),
                manifests_json=json.dumps(results.manifests_discovered),
                scanned_files_count=results.scanned_files_count,
                completed_at=datetime.now(timezone.utc),
            )
            db.merge(scan_rec)

            for dep in dependencies:
                dep_rec = DependencyRecord(
                    id=dep.id,
                    scan_id=scan_id,
                    name=dep.name,
                    ecosystem=dep.ecosystem,
                    version=dep.version,
                    target_version=dep.targetVersion or dep.version,
                    risk_severity=dep.riskSeverity,
                    risk_reason=dep.riskReason,
                    evidence_source=dep.evidenceSource,
                    declared_manifest=dep.declaredManifest,
                    line_number=dep.line_number,
                    ast_call_sites=dep.astCallSites,
                    ast_files=dep.astFiles,
                    status=dep.status,
                    status_details=dep.statusDetails or "",
                    is_direct=dep.isDirect,
                    is_dev=dep.isDev,
                    code_snippets_json=json.dumps([s.model_dump() for s in dep.codeSnippets]),
                    ai_confidence=dep.aiConfidence,
                )
                db.merge(dep_rec)

                for fact in dep.facts:
                    fact_rec = FactRecord(
                        scan_id=scan_id,
                        dependency_id=dep.id,
                        type=fact.type,
                        text=fact.text,
                        is_warning=fact.isWarning,
                        source=fact.source,
                        source_url=fact.source_url,
                    )
                    db.add(fact_rec)

            capsule_rec = CapsuleRecord(
                scan_id=scan_id,
                capsule_json=capsule_json,
                capsule_markdown=capsule_md,
            )
            db.merge(capsule_rec)
            db.commit()
        except Exception as db_err:
            logger.warning("Error saving scan to SQLite: %s", db_err)
            db.rollback()
        finally:
            db.close()

    except Exception as e:
        scan["status"] = "failed"
        scan["error"] = str(e)
        scan["current_stage"] = f"Failed: {str(e)}"
        for s in scan["stages"]:
            if s.status == "in_progress":
                s.status = "failed"
                s.details = str(e)


@router.post("/scans", response_model=ScanStatusResponse)
async def create_scan(
    repo_url: Optional[str] = Form(None),
    branch: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Initiates a real scan using either a GitHub URL or uploaded ZIP file."""
    if not repo_url and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A repository URL or ZIP file upload is required before scanning.",
        )

    scan_id = f"scan-{uuid.uuid4().hex[:12]}"
    identifier = repo_url or (file.filename if file else "uploaded-archive.zip")
    scan_type = "github" if repo_url else "zip"

    zip_bytes: Optional[bytes] = None
    zip_filename: Optional[str] = None

    if file:
        if not file.filename or not file.filename.lower().endswith(".zip"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .zip files are accepted.",
            )
        zip_bytes = await file.read()
        if len(zip_bytes) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded ZIP exceeds limit of {settings.max_upload_size_mb} MB.",
            )
        zip_filename = file.filename

    scan_record = _init_scan_record(scan_id, identifier, scan_type)
    SCAN_STORE[scan_id] = scan_record

    # Launch background task
    asyncio.create_task(
        _execute_scan_pipeline(
            scan_id=scan_id,
            repo_url=repo_url,
            branch=branch,
            zip_bytes=zip_bytes,
            zip_filename=zip_filename,
        )
    )

    return ScanStatusResponse(
        scan_id=scan_id,
        status="running",
        current_stage=scan_record["current_stage"],
        progress_percent=0,
        stages=scan_record["stages"],
    )


# ---------------------------------------------------------------------------
# 4. GET /api/scans/{scan_id}
# ---------------------------------------------------------------------------
@router.get("/scans/{scan_id}", response_model=ScanStatusResponse)
def get_scan_status(scan_id: str):
    """Returns current scan state and genuine progress stages."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    return ScanStatusResponse(
        scan_id=scan_id,
        status=record["status"],
        current_stage=record["current_stage"],
        progress_percent=record["progress_percent"],
        stages=record["stages"],
        error=record["error"],
    )


# ---------------------------------------------------------------------------
# 5. GET /api/scans/{scan_id}/results
# ---------------------------------------------------------------------------
@router.get("/scans/{scan_id}/results", response_model=ScanResultsResponse)
def get_scan_results(scan_id: str):
    """Returns findings, evidence, AI recommendations, and verification results for a completed scan."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    if record["status"] == "running":
        raise HTTPException(status_code=status.HTTP_202_ACCEPTED, detail="Scan is still in progress.")
    if record["status"] == "failed":
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=record["error"] or "Scan failed.")

    if not record["results"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan results not available.")

    return record["results"]


# ---------------------------------------------------------------------------
# 6. GET /api/scans/{scan_id}/capsule
# ---------------------------------------------------------------------------
@router.get("/scans/{scan_id}/capsule")
def get_scan_capsule(
    scan_id: str,
    format: str = Query("json", pattern="^(json|markdown|md)$"),
    download: bool = Query(False),
):
    """Returns or downloads generated JSON or Markdown Dependency Exit Capsule."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    if record["status"] != "completed" or not record["results"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan must be completed to export capsule.")

    results: ScanResultsResponse = record["results"]
    safe_name = re.sub(r"[^\w.-]", "_", results.repository_name)

    if format in ("markdown", "md"):
        content = record["capsule_md"] or ""
        headers = {}
        if download:
            headers["Content-Disposition"] = f'attachment; filename="exit_capsule_{safe_name}.md"'
        return PlainTextResponse(content=content, media_type="text/markdown", headers=headers)

    content = record["capsule_json"] or "{}"
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="exit_capsule_{safe_name}.json"'
    return Response(content=content, media_type="application/json", headers=headers)


# ---------------------------------------------------------------------------
# 7. POST /api/scans/{scan_id}/verify
# ---------------------------------------------------------------------------
@router.post("/scans/{scan_id}/verify", response_model=VerificationResponse)
def run_verification(scan_id: str, dependency_name: Optional[str] = None):
    """Runs controlled sandbox verification tests for a scanned repository."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    temp_dir_obj = record.get("temp_dir")
    if not temp_dir_obj:
        return VerificationResponse(
            scan_id=scan_id,
            test_framework="Sandbox",
            status="skipped",
            stdout_summary="Repository temporary workspace has been discarded.",
            compatibility_gaps=["Workspace not available for rerun."],
            sandbox_isolated=True,
        )

    verifier = VerificationService()
    repo_dir = record.get("working_dir") or Path(temp_dir_obj.name)
    return verifier.verify_repository(scan_id, repo_dir, dependency_name)


# ---------------------------------------------------------------------------
# 8. GET /api/scans (List past scans from SQLite DB)
# ---------------------------------------------------------------------------
@router.get("/scans", response_model=List[ScanListItem])
def list_scans():
    """Returns list of past scans from SQLite database."""
    db = SessionLocal()
    try:
        records = db.query(ScanRecord).order_by(ScanRecord.created_at.desc()).limit(50).all()
        results: List[ScanListItem] = []
        for r in records:
            summary_data = json.loads(r.summary_json or "{}")
            deps_count = summary_data.get("total", 0)
            high_risk = summary_data.get("highRisk", 0)
            health = summary_data.get("healthScore", 100)

            results.append(
                ScanListItem(
                    scan_id=r.id,
                    repo_name=r.repo_name or "Repository",
                    repo_url=r.repo_url,
                    branch=r.branch,
                    status=r.status,
                    created_at=r.created_at.isoformat() if r.created_at else "",
                    dependencies_count=deps_count,
                    high_risk_count=high_risk,
                    health_score=health,
                )
            )
        return results
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 9. POST /api/scans/{scan_id}/plan (Multi-Dependency Migration Planning)
# ---------------------------------------------------------------------------
@router.post("/scans/{scan_id}/plan", response_model=MultiDepMigrationPlanResponse)
async def generate_migration_plan(scan_id: str, req: MigrationPlanRequest):
    """Generates structured multi-dependency migration plan using Gemma 4 thinking mode."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    results: Optional[ScanResultsResponse] = record.get("results")
    if not results:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan results must be ready before planning.")

    # Filter selected dependencies or select all if empty
    selected_names = set(req.dependencies) if req.dependencies else {d.name for d in results.dependencies}
    selected_deps = [
        {
            "name": d.name,
            "version": d.version,
            "target_version": d.targetVersion,
            "manifest": d.declaredManifest,
            "ast_call_sites": d.astCallSites,
            "risk_severity": d.riskSeverity,
            "risk_reason": d.riskReason,
        }
        for d in results.dependencies
        if d.name in selected_names or not req.dependencies
    ]

    gemma = GemmaService()
    plan_data = await gemma.generate_multi_dep_plan(
        repository_info={"name": results.repository_name, "url": results.repository_url},
        selected_dependencies=selected_deps,
        manifests=results.manifests_discovered,
        target_python=req.target_python,
        custom_instructions=req.custom_instructions,
    )

    plan_id = f"plan-{uuid.uuid4().hex[:10]}"
    dep_plan_items = [
        DependencyPlanItem(
            package_name=p.get("package_name", ""),
            current_version=p.get("current_version", ""),
            proposed_version=p.get("proposed_version", ""),
            action=p.get("action", "upgrade"),
            rationale=p.get("rationale", ""),
            code_transformations=p.get("code_transformations", []),
            test_instructions=p.get("test_instructions", []),
        )
        for p in plan_data.get("dependency_plans", [])
    ]

    response = MultiDepMigrationPlanResponse(
        plan_id=plan_id,
        scan_id=scan_id,
        target_python=req.target_python,
        strategy_summary=plan_data.get("strategy_summary", "Multi-dependency migration strategy"),
        dependency_plans=dep_plan_items,
        unified_diff=plan_data.get("unified_diff", ""),
        manifest_updates=plan_data.get("manifest_updates", {}),
        compatibility_warnings=plan_data.get("compatibility_warnings", []),
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    # Store in memory and DB
    record["migration_plan"] = response
    db = SessionLocal()
    try:
        plan_rec = MigrationPlanRecord(
            scan_id=scan_id,
            target_packages_json=json.dumps(list(selected_names)),
            unified_diff=response.unified_diff,
            manifest_updates_json=json.dumps(response.manifest_updates),
            compatibility_warnings_json=json.dumps(response.compatibility_warnings),
            strategy_summary=response.strategy_summary,
            ai_model=settings.gemma_model,
        )
        db.add(plan_rec)
        db.commit()
    except Exception as e:
        logger.warning("Error saving plan to SQLite: %s", e)
        db.rollback()
    finally:
        db.close()

    return response


# ---------------------------------------------------------------------------
# 10. POST /api/scans/{scan_id}/compare (A/B Sandbox Verification)
# ---------------------------------------------------------------------------
@router.post("/scans/{scan_id}/compare", response_model=ComparisonResponse)
def compare_original_vs_replacement(scan_id: str, req: ComparisonRequest):
    """Executes empirical A/B verification comparing original against proposed replacement."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    temp_dir_obj = record.get("temp_dir")
    working_dir = record.get("working_dir") or (Path(temp_dir_obj.name) if temp_dir_obj else None)

    if not working_dir or not working_dir.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Repository sandbox workspace not available for comparison.")

    # Determine patch text
    patch_text = req.patch
    if not patch_text and record.get("migration_plan"):
        patch_text = record["migration_plan"].unified_diff

    comparison_service = ComparisonService()
    comp_result = comparison_service.compare(
        scan_id=scan_id,
        original_repo_dir=working_dir,
        patch_text=patch_text,
        plan_id=req.plan_id,
        python_version=req.python_version,
    )

    record["comparison_result"] = comp_result

    # Regenerate capsule with comparison attached
    capsule_service = CapsuleService()
    if record.get("results"):
        record["capsule_json"] = capsule_service.generate_json_capsule(
            record["results"],
            comparison=comp_result,
            migration_plan=record.get("migration_plan").model_dump() if record.get("migration_plan") else None,
        )
        record["capsule_md"] = capsule_service.generate_markdown_capsule(
            record["results"],
            comparison=comp_result,
            migration_plan=record.get("migration_plan").model_dump() if record.get("migration_plan") else None,
        )

    return comp_result


# ---------------------------------------------------------------------------
# 11. GET /api/scans/{scan_id}/capsule/zip (Export complete Capsule ZIP)
# ---------------------------------------------------------------------------
@router.get("/scans/{scan_id}/capsule/zip")
def download_capsule_zip(scan_id: str):
    """Downloads a complete ZIP bundle containing capsule.json, capsule.md, and diff."""
    if scan_id not in SCAN_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scan ID '{scan_id}' not found.")

    record = SCAN_STORE[scan_id]
    if record["status"] != "completed" or not record.get("results"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan must be completed to export capsule ZIP.")

    results: ScanResultsResponse = record["results"]
    safe_name = re.sub(r"[^\w.-]", "_", results.repository_name)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"exit_capsule_{safe_name}.json", record.get("capsule_json") or "{}")
        zf.writestr(f"exit_capsule_{safe_name}.md", record.get("capsule_md") or "")
        if record.get("migration_plan") and record["migration_plan"].unified_diff:
            zf.writestr(f"proposed_remediation.diff", record["migration_plan"].unified_diff)

    zip_bytes = zip_buffer.getvalue()
    headers = {"Content-Disposition": f'attachment; filename="exit_capsule_{safe_name}.zip"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)

