"""Deterministic dependency analyzer combining manifest declarations, AST usages, and Gemma 4 AI insights."""

import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

from app.schemas import (
    DiscoveredDependency,
    ScanSummary,
    CodeSnippet,
    RiskFact,
    MigrationRecommendation,
    DiffSnippet,
    GemmaAnalysisResponse,
)
from app.services.manifest_parser import (
    scan_manifests_in_directory,
    ParsedManifestDependency,
)
from app.services.usage_mapper import (
    map_usages_in_directory,
    get_usages_for_package,
    CodeUsageOccurrence,
)
from app.services.gemma_service import GemmaService, GemmaServiceError

from app.services.registry_service import RegistryService

logger = logging.getLogger("depguard.analyzer")

# Programmatically known Python 3.12 & 3.13 removals / deprecations (Deterministic Rules)
PYTHON_REMOVAL_FLAGS: Dict[str, Dict[str, Any]] = {
    "distutils": {
        "severity": "High",
        "reason": "Removed from Python 3.12 standard library (PEP 632). Use setuptools or packaging.",
        "target": "setuptools>=69.0.0",
        "replacements": ["setuptools", "packaging"],
        "category": "deprecation",
    },
    "imp": {
        "severity": "High",
        "reason": "Removed in Python 3.12 in favor of standard importlib.",
        "target": "importlib",
        "replacements": ["importlib.util"],
        "category": "deprecation",
    },
    "nose": {
        "severity": "High",
        "reason": "Unmaintained test runner incompatible with Python 3.12+ (ModuleNotFoundError: No module named 'imp').",
        "target": "pytest>=8.0.0",
        "replacements": ["pytest"],
        "category": "maintenance",
    },
    "pycrypto": {
        "severity": "High",
        "reason": "Unmaintained since 2014 with multiple unpatched CVEs. Incompatible with modern OpenSSL.",
        "target": "cryptography>=43.0.0",
        "replacements": ["cryptography", "pycryptodome"],
        "category": "maintenance",
    },
    "asyncore": {
        "severity": "High",
        "reason": "Removed from Python 3.13 standard library (PEP 594). Use asyncio.",
        "target": "asyncio",
        "replacements": ["asyncio", "anyio"],
        "category": "deprecation",
    },
    "asynchat": {
        "severity": "High",
        "reason": "Removed from Python 3.13 standard library (PEP 594). Use asyncio streams.",
        "target": "asyncio",
        "replacements": ["asyncio"],
        "category": "deprecation",
    },
    "telnetlib": {
        "severity": "High",
        "reason": "Removed from Python 3.13 standard library (PEP 594). Use telnetlib3.",
        "target": "telnetlib3>=2.0.0",
        "replacements": ["telnetlib3"],
        "category": "deprecation",
    },
}


class DependencyAnalyzer:
    """Orchestrates deterministic manifest discovery, AST usage mapping, registry telemetry, and AI analysis."""

    def __init__(
        self,
        gemma_service: Optional[GemmaService] = None,
        registry_service: Optional[RegistryService] = None,
    ):
        self.gemma_service = gemma_service or GemmaService()
        self.registry_service = registry_service or RegistryService()

    async def analyze_repository(
        self,
        repo_dir: Path,
        repo_metadata: Dict[str, Any],
    ) -> Tuple[List[DiscoveredDependency], ScanSummary, List[str], Optional[str], Optional[str], List[str]]:
        """Performs full deterministic scan followed by Gemma 4 analysis.
        Returns (dependencies, summary, discovered_manifests, ai_assessment, ai_model_used, limitations).
        """
        limitations: List[str] = []

        # 1. Parse manifests deterministically
        manifest_deps = scan_manifests_in_directory(repo_dir)
        discovered_manifests = sorted(list({dep.manifest_path for dep in manifest_deps}))

        # 2. Map AST source-code usages
        usages_by_pkg = map_usages_in_directory(repo_dir)

        # 3. If no manifests found, infer from source imports
        if not manifest_deps:
            limitations.append("No recognized manifest found (requirements.txt, pyproject.toml, package.json).")
            std_lib = {
                "os", "sys", "re", "json", "time", "math", "typing", "pathlib", "collections",
                "itertools", "functools", "logging", "unittest", "tempfile", "shutil", "io",
                "subprocess", "threading", "multiprocessing", "hashlib", "urllib", "http",
                "datetime", "csv", "xml", "sqlite3", "copy", "socket", "struct", "random",
            }
            for pkg_key, occurrences in usages_by_pkg.items():
                if pkg_key not in std_lib and len(pkg_key) > 2:
                    manifest_deps.append(
                        ParsedManifestDependency(
                            name=pkg_key,
                            specifier="unpinned (inferred)",
                            manifest_path=occurrences[0].file_path if occurrences else "source",
                            ecosystem="pypi",
                            category="runtime",
                            is_direct=True,
                        )
                    )

        # Detect cross-manifest conflicts (e.g. pydantic==1.10.13 in requirements.txt vs pydantic>=2 in pyproject.toml)
        manifest_by_name: Dict[str, List[ParsedManifestDependency]] = {}
        for d in manifest_deps:
            manifest_by_name.setdefault(d.name.lower(), []).append(d)

        # 4. Concurrently query Registry & OSV intelligence for all dependencies
        intel_tasks = [
            self.registry_service.get_package_intel(dep.name, dep.specifier, dep.ecosystem)
            for dep in manifest_deps
        ]
        intel_results = await asyncio.gather(*intel_tasks, return_exceptions=True)
        intel_by_pkg: Dict[str, Dict[str, Any]] = {}
        for dep, intel in zip(manifest_deps, intel_results):
            if isinstance(intel, dict):
                intel_by_pkg[dep.name.lower()] = intel
            else:
                intel_by_pkg[dep.name.lower()] = {}

        # 5. Correlate manifest declarations with source usages and registry telemetry
        evidence_payload: List[Dict[str, Any]] = []
        base_dependencies: List[Dict[str, Any]] = []

        for idx, dep in enumerate(manifest_deps):
            occurrences = get_usages_for_package(dep.name, usages_by_pkg)
            call_sites_count = len(occurrences)
            affected_files = sorted(list({occ.file_path for occ in occurrences}))

            lower_name = dep.name.lower()
            known_flag = PYTHON_REMOVAL_FLAGS.get(lower_name)
            pkg_intel = intel_by_pkg.get(lower_name, {})

            # Check cross-manifest conflict
            all_decls = manifest_by_name.get(lower_name, [])
            manifest_conflict: Optional[str] = None
            if len(all_decls) > 1:
                specifiers = {d.specifier for d in all_decls}
                if len(specifiers) > 1:
                    manifest_conflict = f"Conflicting declarations: " + ", ".join(f"{d.manifest_path} specifies '{d.specifier}'" for d in all_decls)

            evidence_item = {
                "package_name": dep.name,
                "version": dep.specifier,
                "manifest": dep.manifest_path,
                "category": dep.category,
                "call_sites_count": call_sites_count,
                "affected_files": affected_files[:5],
                "deterministic_issue": known_flag["reason"] if known_flag else manifest_conflict,
                "is_commented": dep.is_commented,
                "osv_advisories": [v.get("cve_id") for v in pkg_intel.get("osv_vulnerabilities", [])],
            }
            evidence_payload.append(evidence_item)

            base_dependencies.append({
                "index": idx,
                "dep": dep,
                "occurrences": occurrences,
                "affected_files": affected_files,
                "known_flag": known_flag,
                "manifest_conflict": manifest_conflict,
                "pkg_intel": pkg_intel,
            })

        # 6. Invoke Gemma 4 for intelligent dependency resilience assessment
        ai_response: Optional[GemmaAnalysisResponse] = None
        ai_assessment: Optional[str] = None
        ai_model_used: Optional[str] = None

        if base_dependencies:
            try:
                ai_response = await self.gemma_service.analyze_dependencies(
                    repository_info=repo_metadata,
                    manifests=discovered_manifests,
                    dependencies_payload=evidence_payload,
                )
                ai_assessment = ai_response.overall_assessment or ai_response.summary
                ai_model_used = self.gemma_service.primary_model
            except GemmaServiceError as gemma_err:
                logger.warning("Gemma analysis unavailable (%s): %s", gemma_err.error_type, gemma_err.message)
                limitations.append(f"AI analysis note: {gemma_err.message}")
            except Exception as e:
                logger.warning("Unexpected error during AI analysis: %s", e)
                limitations.append("AI reasoning unavailable; relying on deterministic scan evidence.")

        ai_findings_by_pkg: Dict[str, Any] = {}
        if ai_response and ai_response.findings:
            for f in ai_response.findings:
                ai_findings_by_pkg[f.package_name.lower()] = f

        # 7. Assemble final DiscoveredDependency objects with provenance-tagged facts
        final_dependencies: List[DiscoveredDependency] = []

        for item in base_dependencies:
            dep: ParsedManifestDependency = item["dep"]
            occurrences: List[CodeUsageOccurrence] = item["occurrences"]
            affected_files: List[str] = item["affected_files"]
            known_flag = item["known_flag"]
            manifest_conflict = item["manifest_conflict"]
            pkg_intel = item["pkg_intel"]
            lower_name = dep.name.lower()

            ai_finding = ai_findings_by_pkg.get(lower_name)
            pypi_info = pkg_intel.get("pypi", {})
            osv_vulns = pkg_intel.get("osv_vulnerabilities", [])

            # Check specific LinkWatch issues dynamically:
            # 1. Jinja2 2.11.3 soft_unicode failure
            is_jinja_issue = lower_name == "jinja2" and (dep.specifier.startswith("2.") or dep.specifier.startswith("==2."))
            # 2. IDNA 2.7 CVE-2024-3651
            has_cve = len(osv_vulns) > 0

            # Determine Risk Severity
            if known_flag:
                risk_severity = known_flag["severity"]
                risk_reason = known_flag["reason"]
            elif manifest_conflict:
                risk_severity = "High"
                risk_reason = manifest_conflict
            elif is_jinja_issue:
                risk_severity = "High"
                risk_reason = "Jinja2 2.11.3 fails with modern MarkupSafe: soft_unicode was removed from markupsafe. Upgrade to jinja2>=3.1.4."
            elif has_cve:
                risk_severity = "High"
                cve_names = ", ".join(v.get("cve_id", "vulnerability") for v in osv_vulns[:2])
                risk_reason = f"Security vulnerability identified ({cve_names}): {osv_vulns[0].get('summary', 'Known vulnerability')}"
            elif ai_finding:
                level = ai_finding.risk_level.lower()
                if level in ("critical", "high"):
                    risk_severity = "High"
                elif level in ("medium", "low"):
                    risk_severity = "Needs Review" if level == "medium" else "Low"
                else:
                    risk_severity = "Needs Review"
                risk_reason = ai_finding.reasoning_summary
            elif dep.specifier.startswith("0.") or dep.specifier.startswith("1.0"):
                risk_severity = "Needs Review"
                risk_reason = f"Legacy version constraint ({dep.specifier}). Review compatibility with Python 3.12+."
            elif dep.is_commented:
                risk_severity = "Low"
                risk_reason = f"Commented out in {dep.manifest_path} (not loaded at runtime)."
            else:
                risk_severity = "Low"
                risk_reason = f"Declared in {dep.manifest_path} with standard runtime compatibility."

            # Build Code Snippets
            code_snippets: List[CodeSnippet] = []
            if occurrences:
                for occ in occurrences[:5]:
                    code_snippets.append(
                        CodeSnippet(
                            file=occ.file_path,
                            line=occ.line_number,
                            purpose=occ.purpose,
                            code=occ.code_snippet,
                            kind=occ.kind,
                        )
                    )
            else:
                code_snippets.append(
                    CodeSnippet(
                        file=dep.manifest_path,
                        line=dep.line_number,
                        purpose=f"Manifest declaration in {dep.manifest_path}",
                        code=f"{dep.name}=={dep.specifier}",
                        kind="config",
                    )
                )

            # Build Provenance Facts (OBSERVED, REGISTRY, OSV, GITHUB, INFERRED)
            facts: List[RiskFact] = []

            # 1. Manifest OBSERVED fact
            comment_tag = " [Commented out]" if dep.is_commented else ""
            facts.append(
                RiskFact(
                    type="OBSERVED",
                    text=f"Manifest declaration: {dep.name} ({dep.specifier}){comment_tag} in {dep.manifest_path}:{dep.line_number}",
                    isWarning=risk_severity == "High",
                    source=f"{dep.manifest_path}:{dep.line_number}",
                )
            )

            # 2. AST OBSERVED facts
            if occurrences:
                monkey_patches = [o for o in occurrences if o.kind == "monkey_patch"]
                calls = [o for o in occurrences if o.kind == "call"]
                attrs = [o for o in occurrences if o.kind == "attribute"]

                facts.append(
                    RiskFact(
                        type="OBSERVED",
                        text=f"Traced {len(occurrences)} active code references across {len(affected_files)} source files ({', '.join(affected_files[:3])}).",
                        isWarning=False,
                        source=affected_files[0] if affected_files else None,
                    )
                )

                if monkey_patches:
                    for mp in monkey_patches[:2]:
                        facts.append(
                            RiskFact(
                                type="OBSERVED",
                                text=f"Active monkey patching detected: {mp.purpose} at {mp.file_path}:{mp.line_number}",
                                isWarning=True,
                                source=f"{mp.file_path}:{mp.line_number}",
                            )
                        )
                if attrs:
                    for at in attrs[:2]:
                        facts.append(
                            RiskFact(
                                type="OBSERVED",
                                text=f"Internal / private attribute lookup: {at.purpose} at {at.file_path}:{at.line_number}",
                                isWarning=False,
                                source=f"{at.file_path}:{at.line_number}",
                            )
                        )
            else:
                facts.append(
                    RiskFact(
                        type="INFERRED",
                        text=f"No direct code imports or calls detected in scanned source files for '{dep.name}' (potential phantom or transitive requirement).",
                        isWarning=False,
                    )
                )

            # 3. Cross-manifest conflict fact
            if manifest_conflict:
                facts.append(
                    RiskFact(
                        type="OBSERVED",
                        text=manifest_conflict,
                        isWarning=True,
                        source=dep.manifest_path,
                    )
                )

            # 4. PyPI REGISTRY facts
            if pypi_info.get("exists"):
                latest_v = pypi_info.get("latest_version")
                rel_date = pypi_info.get("latest_release_date", "unknown")
                req_py = pypi_info.get("requires_python") or "unspecified"
                pypi_url = pypi_info.get("pypi_url")
                facts.append(
                    RiskFact(
                        type="REGISTRY",
                        text=f"PyPI release telemetry: latest version is {latest_v} (published {rel_date}). Declared requires-python: '{req_py}'.",
                        isWarning=False,
                        source="pypi.org",
                        source_url=pypi_url,
                    )
                )
                if pypi_info.get("is_stale"):
                    facts.append(
                        RiskFact(
                            type="REGISTRY",
                            text=f"PyPI inactivity: No package updates released in over 24 months (last upload: {rel_date}).",
                            isWarning=True,
                            source="pypi.org",
                            source_url=pypi_url,
                        )
                    )

            # 5. OSV Security facts
            if osv_vulns:
                for v in osv_vulns[:3]:
                    facts.append(
                        RiskFact(
                            type="OSV",
                            text=f"Vulnerability {v.get('cve_id')}: {v.get('summary')} (Fixed in: {', '.join(v.get('fixed_versions', [])) or 'unspecified'})",
                            isWarning=True,
                            source="osv.dev",
                            source_url=v.get("source_url"),
                        )
                    )

            # 6. Gemma AI Inferred facts
            if ai_finding and ai_finding.evidence:
                for ev in ai_finding.evidence[:2]:
                    facts.append(
                        RiskFact(
                            type="INFERRED",
                            text=f"Gemma 4 reasoning: {ev}",
                            isWarning=risk_severity == "High",
                        )
                    )

            # Build Migration Recommendation
            migration_rec: Optional[MigrationRecommendation] = None
            if ai_finding and ai_finding.replacement_candidates:
                target_pkgs = ai_finding.replacement_candidates
                migration_rec = MigrationRecommendation(
                    title=f"Upgrade / Migrate {dep.name} to modern spec",
                    targetPackages=target_pkgs,
                    description=ai_finding.reasoning_summary,
                    confidence=ai_finding.confidence,
                    estimatedSynthesisTime=None,
                    astTransformAvailable=len(affected_files) > 0,
                    diffSnippet=DiffSnippet(
                        original=f"- {dep.name}=={dep.specifier}",
                        replacement=f"+ {target_pkgs[0]}",
                    ),
                )
            elif known_flag:
                migration_rec = MigrationRecommendation(
                    title=f"Replace deprecated {dep.name}",
                    targetPackages=known_flag["replacements"],
                    description=known_flag["reason"],
                    confidence=0.98,
                    estimatedSynthesisTime=None,
                    astTransformAvailable=len(affected_files) > 0,
                    diffSnippet=DiffSnippet(
                        original=f"- {dep.name}=={dep.specifier}",
                        replacement=f"+ {known_flag['replacements'][0]}",
                    ),
                )
            elif is_jinja_issue:
                migration_rec = MigrationRecommendation(
                    title="Upgrade Jinja2 for MarkupSafe compatibility",
                    targetPackages=["jinja2>=3.1.4"],
                    description="Jinja2 2.11.3 SoftUnicode error on Python 3.12 with MarkupSafe>=2.1. Upgrade to jinja2>=3.1.4.",
                    confidence=0.99,
                    estimatedSynthesisTime=None,
                    astTransformAvailable=True,
                    diffSnippet=DiffSnippet(
                        original="- Jinja2==2.11.3",
                        replacement="+ Jinja2>=3.1.4",
                    ),
                )
            elif has_cve:
                fixed_ver = osv_vulns[0].get("fixed_versions", [f">={dep.specifier}"])[0] if osv_vulns[0].get("fixed_versions") else "latest"
                migration_rec = MigrationRecommendation(
                    title=f"Remediate security advisory in {dep.name}",
                    targetPackages=[f"{dep.name}>={fixed_ver}"],
                    description=f"Patch {osv_vulns[0].get('cve_id')} by upgrading {dep.name}.",
                    confidence=0.95,
                    estimatedSynthesisTime=None,
                    astTransformAvailable=False,
                    diffSnippet=DiffSnippet(
                        original=f"- {dep.name}=={dep.specifier}",
                        replacement=f"+ {dep.name}>={fixed_ver}",
                    ),
                )

            # Status defaults to "Not tested" until empirical sandbox verification executes
            status = "Not tested"

            target_version = (
                known_flag["target"]
                if known_flag
                else (migration_rec.targetPackages[0] if migration_rec and migration_rec.targetPackages else dep.specifier)
            )

            discovered = DiscoveredDependency(
                id=f"dep-{item['index'] + 1}-{dep.name}",
                name=dep.name,
                ecosystem=dep.ecosystem,
                version=dep.specifier,
                targetVersion=target_version,
                riskSeverity=risk_severity,
                riskReason=risk_reason,
                evidenceSource=f"{dep.manifest_path} (AST mapped)",
                declaredManifest=dep.manifest_path,
                line_number=dep.line_number,
                astCallSites=len(occurrences),
                astFiles=len(affected_files),
                status=status,
                statusDetails=risk_reason,
                codeSnippets=code_snippets,
                facts=facts,
                migrationRecommendation=migration_rec,
                aiConfidence=ai_finding.confidence if ai_finding else None,
                isDirect=dep.is_direct,
                isDev=dep.is_dev,
                isCommented=dep.is_commented,
            )
            final_dependencies.append(discovered)

        # 8. Compute Summary
        high_risk_count = sum(1 for d in final_dependencies if d.riskSeverity == "High")
        needs_review_count = sum(1 for d in final_dependencies if d.riskSeverity == "Needs Review")
        healthy_count = sum(1 for d in final_dependencies if d.riskSeverity == "Low")
        total_call_sites = sum(d.astCallSites for d in final_dependencies)

        # Count actual scanned unique code and manifest files
        unique_scanned_files = set()
        for f in repo_dir.rglob("*"):
            if f.is_file() and not any(part in {".git", "node_modules", ".venv", "venv", "__pycache__"} for part in f.parts):
                if f.suffix in {".py", ".ts", ".js", ".tsx", ".jsx", ".toml", ".txt", ".json", ".ini", ".cfg", ".j2"}:
                    unique_scanned_files.add(str(f))

        health_score = max(0, min(100, 100 - (high_risk_count * 20) - (needs_review_count * 5)))

        summary = ScanSummary(
            total=len(final_dependencies),
            highRisk=high_risk_count,
            needsReview=needs_review_count,
            healthy=healthy_count,
            astCallSites=total_call_sites,
            scannedFilesCount=len(unique_scanned_files) or 1,
            verifiedPassing=0,
            healthScore=health_score,
        )

        return (
            final_dependencies,
            summary,
            discovered_manifests,
            ai_assessment,
            ai_model_used,
            limitations,
        )

