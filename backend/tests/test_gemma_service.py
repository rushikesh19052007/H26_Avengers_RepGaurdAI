"""Unit tests for GemmaService using mocks to prevent quota consumption."""

import json
from unittest.mock import MagicMock, patch
import pytest
from google.genai.errors import APIError

from app.services.gemma_service import GemmaService, GemmaServiceError
from app.schemas import GemmaAnalysisResponse


@pytest.fixture
def valid_gemma_json_response() -> str:
    return json.dumps({
        "summary": "Repository dependencies are mostly stable for Python 3.12 with one deprecation.",
        "findings": [
            {
                "package_name": "distutils",
                "risk_level": "high",
                "risk_category": "deprecation",
                "confidence": 0.98,
                "evidence": ["distutils was removed in Python 3.12 core standard library (PEP 632)"],
                "affected_files": ["setup.py", "main.py"],
                "reasoning_summary": "Removed module causes ImportError on Python 3.12+ runtime.",
                "replacement_candidates": ["setuptools", "packaging"],
                "migration_steps": ["Replace distutils imports with setuptools."],
                "verification_requirements": ["Run pytest with Python 3.12"],
                "limitations": ["Transitive build hooks not inspected"],
            }
        ],
        "overall_assessment": "Migrate build system to setuptools to guarantee Python 3.12 compatibility.",
        "unresolved_questions": [],
    })


@pytest.mark.asyncio
async def test_gemma_missing_api_key():
    """GemmaService raises GemmaServiceError when API key is empty."""
    service = GemmaService(api_key="")
    with pytest.raises(GemmaServiceError) as exc_info:
        await service.analyze_dependencies(
            repository_info={"name": "test"},
            manifests=["requirements.txt"],
            dependencies_payload=[],
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.error_type == "API_KEY_MISSING"


@pytest.mark.asyncio
async def test_gemma_successful_analysis(valid_gemma_json_response: str):
    """GemmaService parses and validates structured response."""
    service = GemmaService(api_key="valid-mock-key-for-testing")

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = valid_gemma_json_response
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.analyze_dependencies(
            repository_info={"name": "test-repo"},
            manifests=["requirements.txt"],
            dependencies_payload=[{"package_name": "distutils"}],
        )

        assert isinstance(res, GemmaAnalysisResponse)
        assert len(res.findings) == 1
        assert res.findings[0].package_name == "distutils"
        assert res.findings[0].risk_level == "high"
        assert res.findings[0].confidence == 0.98

        # Verify thinking config was passed
        call_kwargs = mock_client.models.generate_content.call_args[1]
        assert call_kwargs["config"].thinking_config.thinking_level is not None


@pytest.mark.asyncio
async def test_gemma_malformed_json_response():
    """GemmaService raises GemmaServiceError on unparseable JSON."""
    service = GemmaService(api_key="valid-mock-key")

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "This is not valid JSON at all!"
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(service, "_get_client", return_value=mock_client):
        with pytest.raises(GemmaServiceError) as exc_info:
            await service.analyze_dependencies(
                repository_info={"name": "test"},
                manifests=["requirements.txt"],
                dependencies_payload=[],
            )
        assert exc_info.value.error_type == "MALFORMED_OUTPUT"


@pytest.mark.asyncio
async def test_gemma_quota_exhausted_handling():
    """GemmaService raises 429 when API rate limit / quota is exhausted."""
    service = GemmaService(api_key="valid-mock-key")

    mock_client = MagicMock()
    api_error = APIError(code=429, response_json={"error": {"code": 429, "message": "RESOURCE_EXHAUSTED: quota exceeded"}})
    mock_client.models.generate_content.side_effect = api_error

    with patch.object(service, "_get_client", return_value=mock_client):
        with pytest.raises(GemmaServiceError) as exc_info:
            await service.analyze_dependencies(
                repository_info={"name": "test"},
                manifests=["requirements.txt"],
                dependencies_payload=[],
            )
        assert exc_info.value.status_code == 429
        assert exc_info.value.error_type == "QUOTA_EXCEEDED"
