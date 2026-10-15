"""Tests for /api/health and /api/repositories/validate endpoints."""

import pytest
from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """GET /api/health returns 200 with model info and zero secrets."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert "model" in data
    assert "fallback_model" in data
    assert "thinking_level" in data
    assert isinstance(data["api_key_configured"], bool)

    # Security check: never expose API key or secret values
    res_str = response.text.lower()
    assert "aiastudio" not in res_str
    assert "secret" not in res_str
    assert "gemini_api_key=" not in res_str


def test_validate_valid_github_url(client: TestClient):
    """POST /api/repositories/validate with valid GitHub URL."""
    payload = {"repo_url": "https://github.com/pallets/flask"}
    response = client.post("/api/repositories/validate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["valid"] is True
    assert data["repo_type"] == "github"
    assert data["owner"] == "pallets"
    assert data["repo_name"] == "flask"
    assert data["resolved_url"] == "https://github.com/pallets/flask"
    assert len(data["errors"]) == 0


def test_validate_valid_github_shorthand(client: TestClient):
    """POST /api/repositories/validate with shorthand owner/repo."""
    payload = {"repo_url": "psf/requests"}
    response = client.post("/api/repositories/validate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["valid"] is True
    assert data["owner"] == "psf"
    assert data["repo_name"] == "requests"


def test_validate_invalid_github_url(client: TestClient):
    """POST /api/repositories/validate rejects malformed URLs and unsupported hosts."""
    # Unsupported host
    res1 = client.post("/api/repositories/validate", json={"repo_url": "https://gitlab.com/owner/repo"})
    assert res1.json()["valid"] is False
    assert len(res1.json()["errors"]) > 0

    # Command injection attempt
    res2 = client.post("/api/repositories/validate", json={"repo_url": "https://github.com/owner/repo; rm -rf /"})
    assert res2.json()["valid"] is False

    # Path traversal attempt
    res3 = client.post("/api/repositories/validate", json={"repo_url": "../../../etc/passwd"})
    assert res3.json()["valid"] is False


def test_validate_valid_zip_file_metadata(client: TestClient):
    """POST /api/repositories/validate with valid ZIP file metadata."""
    payload = {"file_name": "my-project.zip", "file_size_bytes": 1024 * 1024}
    response = client.post("/api/repositories/validate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["valid"] is True
    assert data["repo_type"] == "zip"
    assert data["repo_name"] == "my-project"


def test_validate_invalid_zip_extension_or_size(client: TestClient):
    """POST /api/repositories/validate rejects non-zip and oversized files."""
    # Non-zip
    res1 = client.post("/api/repositories/validate", json={"file_name": "malicious.tar.gz"})
    assert res1.json()["valid"] is False

    # Oversized file
    res2 = client.post(
        "/api/repositories/validate",
        json={"file_name": "huge.zip", "file_size_bytes": 100 * 1024 * 1024},
    )
    assert res2.json()["valid"] is False
