"""Optional live integration test with real Google Gen AI API (Gemma 4).

Only executed when explicitly enabled via:
RUN_LIVE_GEMINI_TEST=true GEMINI_API_KEY=your_key pytest backend/tests/test_live_gemma_integration.py
"""

import os
import pytest
from app.services.gemma_service import GemmaService


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("RUN_LIVE_GEMINI_TEST") != "true" or not os.getenv("GEMINI_API_KEY"),
    reason="Live Gemini API test requires explicit RUN_LIVE_GEMINI_TEST=true and valid GEMINI_API_KEY",
)
async def test_live_gemma_api_call():
    """Optional live test validating Gemma 4 invocation and thinking configuration against Google AI."""
    service = GemmaService()
    repo_info = {"name": "sample-python-project", "target_runtime": "Python 3.12 / 3.13"}
    manifests = ["requirements.txt"]
    evidence = [
        {
            "package_name": "distutils",
            "version": "unpinned",
            "manifest": "requirements.txt",
            "call_sites_count": 3,
            "affected_files": ["setup.py"],
            "deterministic_issue": "Removed from Python 3.12 standard library (PEP 632).",
        }
    ]

    response = await service.analyze_dependencies(
        repository_info=repo_info,
        manifests=manifests,
        dependencies_payload=evidence,
    )

    assert response is not None
    assert len(response.findings) >= 1
    finding = response.findings[0]
    assert finding.package_name.lower() == "distutils"
    assert finding.risk_level in ("critical", "high")
