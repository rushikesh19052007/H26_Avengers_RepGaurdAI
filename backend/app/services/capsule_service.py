"""Dependency Exit Capsule generation in JSON and Markdown formats."""

import json
from typing import Dict, Any, List
from app.schemas import ScanResultsResponse, DiscoveredDependency


class CapsuleService:
    """Generates standardized Dependency Exit Capsules."""

    def generate_json_capsule(self, results: ScanResultsResponse) -> str:
        """Returns pretty-printed JSON representation of the Exit Capsule."""
        capsule_data = {
            "capsule_schema_version": "1.0.0",
            "generator": "DepGuard AI - Dependency Resilience Engine",
            "repository": {
                "name": results.repository_name,
                "url": results.repository_url,
                "branch": results.branch,
                "commit_sha": results.commit_sha or "HEAD",
                "scanned_files_count": results.scanned_files_count,
            },
            "scan_metadata": {
                "scan_id": results.scan_id,
                "timestamp": results.scan_timestamp,
                "ai_model": results.ai_model_used or "deterministic-engine",
                "manifests_discovered": results.manifests_discovered,
            },
            "summary": results.summary.model_dump(),
            "ai_assessment": results.ai_assessment,
            "verification_status": results.verification_summary,
            "limitations": results.limitations,
            "dependencies": [dep.model_dump() for dep in results.dependencies],
        }
        return json.dumps(capsule_data, indent=2)

    def generate_markdown_capsule(self, results: ScanResultsResponse) -> str:
        """Returns standard Markdown format of the Dependency Exit Capsule."""
        lines: List[str] = []

        lines.append("# DepGuard AI — Dependency Exit Capsule")
        lines.append(f"> **Repository:** [{results.repository_name}]({results.repository_url}) | **Branch:** `{results.branch}` | **Commit:** `{results.commit_sha or 'HEAD'}`")
        lines.append(f"> **Scanned At:** {results.scan_timestamp} | **Scanner:** DepGuard AI v1.0.0 | **Model:** `{results.ai_model_used or 'Deterministic Engine'}`")
        lines.append("")

        lines.append("## 1. Executive Summary")
        lines.append(f"- **Total Dependencies Discovered:** {results.summary.total}")
        lines.append(f"- **High Risk Dependencies:** {results.summary.highRisk}")
        lines.append(f"- **Needs Review:** {results.summary.needsReview}")
        lines.append(f"- **Healthy / Verified:** {results.summary.healthy}")
        lines.append(f"- **Total AST Import Call Sites:** {results.summary.astCallSites}")
        lines.append(f"- **Discovered Manifests:** {', '.join(f'`{m}`' for m in results.manifests_discovered) if results.manifests_discovered else 'None'}")
        lines.append("")

        if results.ai_assessment:
            lines.append("### Gemma 4 Analysis Summary")
            lines.append(f"{results.ai_assessment}")
            lines.append("")

        lines.append("## 2. Dependency Resilience Matrix")
        lines.append("| Package | Version | Manifest | Severity | AST Sites | Status |")
        lines.append("|---|---|---|---|---|---|")
        for dep in results.dependencies:
            lines.append(
                f"| `{dep.name}` | `{dep.version}` | `{dep.declaredManifest}` | **{dep.riskSeverity}** | {dep.astCallSites} | {dep.status} |"
            )
        lines.append("")

        lines.append("## 3. Detailed Findings, Evidence & Migration Recipes")
        for dep in results.dependencies:
            lines.append(f"### {dep.name} (v{dep.version})")
            lines.append(f"- **Risk Level:** {dep.riskSeverity}")
            lines.append(f"- **Reason:** {dep.riskReason}")
            lines.append(f"- **Evidence Source:** `{dep.evidenceSource}`")
            lines.append("")

            # Observed Facts vs Inferences
            lines.append("#### Facts & Evidence")
            for fact in dep.facts:
                prefix = "[OBSERVED]" if fact.type == "OBSERVED" else "[INFERRED]"
                lines.append(f"- **{prefix}** {fact.text}")
            lines.append("")

            # Code Snippets
            if dep.codeSnippets:
                lines.append("#### AST Source Usage")
                for s in dep.codeSnippets[:3]:
                    lines.append(f"- `{s.file}:{s.line}`: `{s.code}` ({s.purpose})")
                lines.append("")

            # Migration Recipe
            if dep.migrationRecommendation:
                rec = dep.migrationRecommendation
                lines.append("#### Migration Plan & Replacement Recipe")
                lines.append(f"- **Title:** {rec.title}")
                lines.append(f"- **Target Packages:** {', '.join(f'`{p}`' for p in rec.targetPackages)}")
                lines.append(f"- **Confidence:** {int(rec.confidence * 100)}%")
                lines.append(f"- **Rationale:** {rec.description}")
                lines.append("```diff")
                lines.append(rec.diffSnippet.original)
                lines.append(rec.diffSnippet.replacement)
                lines.append("```")
                lines.append("")

        lines.append("## 4. Test Verification Status")
        if results.verification_summary:
            for k, v in results.verification_summary.items():
                lines.append(f"- **{k}:** {v}")
        else:
            lines.append("- Safe isolated sandbox test discovery executed; see individual dependency statuses.")
        lines.append("")

        if results.limitations:
            lines.append("## 5. Scope Limitations & Disclaimers")
            for lim in results.limitations:
                lines.append(f"- {lim}")
            lines.append("")

        lines.append("---")
        lines.append("*Generated automatically by DepGuard AI. Contains programmatic facts, AST tracing evidence, and Gemma 4 recommendations.*")

        return "\n".join(lines)
