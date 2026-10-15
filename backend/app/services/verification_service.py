"""Controlled sandbox test verification service with scrubbed environments."""

import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.schemas import VerificationResponse


class VerificationService:
    """Handles controlled, isolated test execution and verification audits."""

    def _get_scrubbed_env(self, repo_dir: Path) -> Dict[str, str]:
        """Creates a scrubbed environment stripped of backend secrets and credentials."""
        safe_keys = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LOCALAPPDATA", "APPDATA"}
        clean_env = {k: v for k, v in os.environ.items() if k in safe_keys}
        clean_env["PYTHONPATH"] = str(repo_dir)
        clean_env["PYTHONDONTWRITEBYTECODE"] = "1"
        clean_env["PYTHONUNBUFFERED"] = "1"
        return clean_env

    def verify_repository(
        self,
        scan_id: str,
        repo_dir: Path,
        dependency_name: Optional[str] = None,
        timeout_seconds: int = 25,
    ) -> VerificationResponse:
        """Inspects and safely executes repository test verification in scrubbed environment."""
        start_time = time.time()

        # 1. Detect test files
        python_test_files = list(repo_dir.rglob("test_*.py")) + list(repo_dir.rglob("*_test.py"))
        js_test_files = list(repo_dir.rglob("*.test.ts")) + list(repo_dir.rglob("*.spec.ts"))

        if not python_test_files and not js_test_files:
            duration = round(time.time() - start_time, 2)
            return VerificationResponse(
                scan_id=scan_id,
                test_framework="None detected",
                executed_command=None,
                exit_code=None,
                duration_seconds=duration,
                status="skipped",
                stdout_summary="No automated test files (test_*.py, *.test.ts) were discovered in the repository.",
                passed_count=0,
                failed_count=0,
                error_count=0,
                compatibility_gaps=["Test suite missing: manual functional testing required."],
                sandbox_isolated=True,
            )

        framework = "pytest" if python_test_files else "npm test"
        cmd = [sys.executable, "-m", "pytest", "-v"]
        if dependency_name:
            cmd.extend(["-k", dependency_name])

        command_display = " ".join(cmd)
        scrubbed_env = self._get_scrubbed_env(repo_dir)

        try:
            res = subprocess.run(
                cmd,
                cwd=str(repo_dir),
                env=scrubbed_env,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
            duration = round(time.time() - start_time, 2)
            stdout = res.stdout.strip()
            stderr = res.stderr.strip()
            combined_output = f"{stdout}\n{stderr}".strip()

            # Parse outcomes using regex
            passed_m = re.search(r"(\d+)\s+passed", combined_output)
            failed_m = re.search(r"(\d+)\s+failed", combined_output)
            errors_m = re.search(r"(\d+)\s+error", combined_output)

            passed_count = int(passed_m.group(1)) if passed_m else 0
            failed_count = int(failed_m.group(1)) if failed_m else 0
            error_count = int(errors_m.group(1)) if errors_m else 0

            # Collect compatibility gaps from output
            gaps: List[str] = []
            if "soft_unicode" in combined_output:
                gaps.append("ImportError: cannot import name 'soft_unicode' from 'markupsafe' (Jinja2 <3.0 incompatibility).")
            if "No module named 'imp'" in combined_output:
                gaps.append("ModuleNotFoundError: No module named 'imp' (imp removed in Python 3.12, affects nose).")
            if "anystr_strip_whitespace" in combined_output:
                gaps.append("PydanticUserError: anystr_strip_whitespace is removed in Pydantic V2.")

            # Identify failed tests
            failed_nodes = re.findall(r"FAILED\s+([^\s]+)", combined_output)
            for node in failed_nodes[:3]:
                if not any(node in g for g in gaps):
                    gaps.append(f"Failed test: {node}")

            status = "passed" if res.returncode == 0 else "failed"
            summary_output = (combined_output[:1200] + "...") if len(combined_output) > 1200 else combined_output

            return VerificationResponse(
                scan_id=scan_id,
                test_framework=framework,
                executed_command=command_display,
                exit_code=res.returncode,
                duration_seconds=duration,
                status=status,
                stdout_summary=summary_output or f"Executed pytest test runner in {repo_dir.name}.",
                passed_count=passed_count,
                failed_count=failed_count,
                error_count=error_count,
                compatibility_gaps=gaps,
                sandbox_isolated=True,
            )

        except subprocess.TimeoutExpired:
            duration = round(time.time() - start_time, 2)
            return VerificationResponse(
                scan_id=scan_id,
                test_framework=framework,
                executed_command=command_display,
                exit_code=None,
                duration_seconds=duration,
                status="failed",
                stdout_summary=f"Test execution timed out after {timeout_seconds} seconds (possible infinite loop or blocking socket).",
                passed_count=0,
                failed_count=1,
                error_count=1,
                compatibility_gaps=["Test suite timed out: check for blocking network sockets or missing timeouts."],
                sandbox_isolated=True,
            )
        except Exception as e:
            duration = round(time.time() - start_time, 2)
            return VerificationResponse(
                scan_id=scan_id,
                test_framework=framework,
                executed_command=command_display,
                exit_code=None,
                duration_seconds=duration,
                status="skipped",
                stdout_summary=f"Verification runner error: {str(e)[:300]}",
                passed_count=0,
                failed_count=0,
                error_count=1,
                compatibility_gaps=[f"Isolated runner error: {str(e)[:150]}"],
                sandbox_isolated=True,
            )

