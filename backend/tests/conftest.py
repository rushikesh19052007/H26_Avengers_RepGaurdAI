"""Pytest fixtures for DepGuard AI backend tests."""

import io
import sys
import zipfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.main import app


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def sample_python_zip() -> bytes:
    """Creates an in-memory ZIP archive representing a safe sample Python project."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # requirements.txt
        zf.writestr(
            "requirements.txt",
            "requests==2.31.0\nbeautifulsoup4>=4.12.0\ndistutils\n# commented line\n",
        )
        # main.py
        zf.writestr(
            "main.py",
            "import requests\nfrom bs4 import BeautifulSoup\n\ndef fetch():\n    r = requests.get('https://example.com')\n    soup = BeautifulSoup(r.text, 'html.parser')\n    return soup.title\n",
        )
        # README.md
        zf.writestr("README.md", "# Test Project\nA sample project for DepGuard AI scanner testing.\n")
    return buf.getvalue()


@pytest.fixture
def empty_zip() -> bytes:
    """Creates an empty ZIP archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", "# Just a readme\nNo dependencies.\n")
    return buf.getvalue()
