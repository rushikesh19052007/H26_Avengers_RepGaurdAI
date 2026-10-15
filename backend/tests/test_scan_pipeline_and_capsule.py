"""End-to-end scan pipeline, status polling, and capsule export tests."""

import io
import time
import pytest
from fastapi.testclient import TestClient


def test_scan_zip_pipeline_and_capsule_export(client: TestClient, sample_python_zip: bytes):
    """End-to-end test of uploading a ZIP, waiting for scan to complete, and exporting capsules."""
    # 1. Start scan with uploaded ZIP
    files = {"file": ("test_project.zip", sample_python_zip, "application/zip")}
    response = client.post("/api/scans", files=files)
    assert response.status_code == 200
    scan_init = response.json()

    scan_id = scan_init["scan_id"]
    assert scan_id.startswith("scan-")
    assert scan_init["status"] in ("running", "completed")
    assert len(scan_init["stages"]) == 9

    # 2. Poll until completed or timeout (max 10 seconds)
    completed = False
    for _ in range(20):
        time.sleep(0.3)
        poll_res = client.get(f"/api/scans/{scan_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        if poll_data["status"] == "completed":
            completed = True
            break
        elif poll_data["status"] == "failed":
            pytest.fail(f"Scan failed unexpectedly: {poll_data.get('error')}")

    assert completed, "Scan did not reach completed state within timeout."

    # 3. Retrieve results
    results_res = client.get(f"/api/scans/{scan_id}/results")
    assert results_res.status_code == 200
    results = results_res.json()

    assert results["scan_id"] == scan_id
    assert results["repository_name"] == "test_project"
    assert "requirements.txt" in results["manifests_discovered"]

    deps = results["dependencies"]
    dep_names = [d["name"] for d in deps]
    assert "requests" in dep_names
    assert "beautifulsoup4" in dep_names
    assert "distutils" in dep_names

    # Check distutils severity
    dist_dep = next(d for d in deps if d["name"] == "distutils")
    assert dist_dep["riskSeverity"] == "High"
    assert "PEP 632" in dist_dep["riskReason"]

    # 4. Export JSON capsule
    capsule_json_res = client.get(f"/api/scans/{scan_id}/capsule?format=json")
    assert capsule_json_res.status_code == 200
    capsule_json = capsule_json_res.json()
    assert capsule_json["capsule_schema_version"] == "1.0.0"
    assert capsule_json["repository"]["name"] == "test_project"
    assert len(capsule_json["dependencies"]) >= 3

    # 5. Export Markdown capsule
    capsule_md_res = client.get(f"/api/scans/{scan_id}/capsule?format=markdown")
    assert capsule_md_res.status_code == 200
    md_text = capsule_md_res.text
    assert "# DepGuard AI — Dependency Exit Capsule" in md_text
    assert "distutils" in md_text

    # 6. Run verification
    verify_res = client.post(f"/api/scans/{scan_id}/verify")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert "status" in verify_data


def test_scan_empty_zip_shows_empty_state_without_fake_data(client: TestClient, empty_zip: bytes):
    """Verifies that an empty repository produces genuine 0-dependency results, not mock demo data."""
    files = {"file": ("empty_repo.zip", empty_zip, "application/zip")}
    response = client.post("/api/scans", files=files)
    assert response.status_code == 200
    scan_id = response.json()["scan_id"]

    # Poll until completed
    for _ in range(15):
        time.sleep(0.3)
        poll = client.get(f"/api/scans/{scan_id}").json()
        if poll["status"] == "completed":
            break

    results = client.get(f"/api/scans/{scan_id}/results").json()
    # Confirm ZERO fabricated dependencies or fake LinkWatch/urlwatch data
    assert results["summary"]["total"] == 0
    assert results["summary"]["highRisk"] == 0
    assert len(results["dependencies"]) == 0
    res_str = str(results).lower()
    assert "linkwatch" not in res_str
    assert "urlwatch" not in res_str
