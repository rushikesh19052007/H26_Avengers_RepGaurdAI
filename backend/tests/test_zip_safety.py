"""Security tests for ZIP archive extraction (ZipSlip, Archive Bomb, Traversal)."""

import io
import zipfile
import pytest
from pathlib import Path
import tempfile

from app.services.repository_service import safe_extract_zip


def test_safe_zip_extraction(sample_python_zip: bytes):
    """Verifies that a valid ZIP archive extracts cleanly without errors."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        dest = Path(tmp_dir)
        extracted = safe_extract_zip(sample_python_zip, dest)
        assert len(extracted) >= 2
        assert (dest / "requirements.txt").exists()
        assert (dest / "main.py").exists()


def test_zipslip_traversal_prevention():
    """Verifies that ZipSlip (../relative path traversal) is detected and blocked."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # Create malicious ZipSlip entry attempting to write outside target_dir
        zf.writestr("../../escaped_file.txt", "malicious payload")

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest = Path(tmp_dir)
        with pytest.raises(ValueError, match="ZipSlip|Illegal path"):
            safe_extract_zip(buf.getvalue(), dest)


def test_zip_archive_bomb_file_count_limit():
    """Verifies that archives with excessive file count are rejected."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i in range(25):
            zf.writestr(f"file_{i}.txt", "test")

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest = Path(tmp_dir)
        # Enforce strict max_files=10 to test limit
        with pytest.raises(ValueError, match="maximum allowable file count"):
            safe_extract_zip(buf.getvalue(), dest, max_files=10)


def test_zip_archive_bomb_size_limit():
    """Verifies that archives exceeding uncompressed size limits are rejected."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Highly compressible large file
        zf.writestr("large.txt", "A" * (5 * 1024 * 1024))  # 5MB

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest = Path(tmp_dir)
        # Limit to 1MB uncompressed
        with pytest.raises(ValueError, match="uncompressed size exceeds limit"):
            safe_extract_zip(buf.getvalue(), dest, max_uncompressed_bytes=1 * 1024 * 1024)


def test_corrupt_zip_handling():
    """Verifies that corrupted bytes return ValueError."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        dest = Path(tmp_dir)
        with pytest.raises(ValueError, match="Invalid ZIP file"):
            safe_extract_zip(b"not a valid zip file binary stream", dest)
