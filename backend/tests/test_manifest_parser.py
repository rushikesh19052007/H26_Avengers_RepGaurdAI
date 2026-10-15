"""Tests for deterministic manifest parsing across Python and JS/TS ecosystems."""

import pytest
from pathlib import Path
import tempfile

from app.services.manifest_parser import (
    parse_requirements_txt,
    parse_pyproject_toml,
    parse_package_json,
    parse_pipfile,
    scan_manifests_in_directory,
)


def test_parse_requirements_txt():
    """Parses standard requirements.txt content."""
    content = """
    # This is a comment
    requests==2.31.0
    beautifulsoup4>=4.12.0; python_version >= '3.8'
    fastapi~=0.115.0 # inline comment
    pydantic[email]>=2.9.0
    --extra-index-url https://pypi.org/simple
    git+https://github.com/org/repo.git
    distutils
    """
    deps = parse_requirements_txt(content, "requirements.txt")
    names = [d.name for d in deps]

    assert "requests" in names
    assert "beautifulsoup4" in names
    assert "fastapi" in names
    assert "pydantic" in names
    assert "distutils" in names

    req_dep = next(d for d in deps if d.name == "requests")
    assert req_dep.specifier == "==2.31.0"
    assert req_dep.ecosystem == "pypi"
    assert req_dep.category == "runtime"


def test_parse_pyproject_toml():
    """Parses PEP 621 and Poetry format pyproject.toml."""
    content = """
    [project]
    name = "demo-app"
    version = "0.1.0"
    dependencies = [
        "flask>=3.0.0",
        "httpx==0.27.0",
    ]

    [project.optional-dependencies]
    test = [
        "pytest>=8.0.0",
    ]

    [tool.poetry.dependencies]
    python = "^3.12"
    celery = "^5.3.0"
    """
    deps = parse_pyproject_toml(content, "pyproject.toml")
    names = [d.name for d in deps]

    assert "flask" in names
    assert "httpx" in names
    assert "pytest" in names
    assert "celery" in names
    assert "python" not in names  # python runtime itself should not be listed as a package


def test_parse_package_json():
    """Parses npm package.json runtime and dev dependencies."""
    content = """
    {
      "name": "frontend",
      "dependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "typescript": "^5.7.0",
        "vite": "^6.0.0"
      }
    }
    """
    deps = parse_package_json(content, "package.json")
    assert len(deps) == 4

    react_dep = next(d for d in deps if d.name == "react")
    assert react_dep.category == "runtime"
    assert react_dep.ecosystem == "npm"

    vite_dep = next(d for d in deps if d.name == "vite")
    assert vite_dep.category == "development"
    assert vite_dep.ecosystem == "npm"


def test_parse_pipfile():
    """Parses Pipfile packages."""
    content = """
    [[source]]
    url = "https://pypi.org/simple"
    verify_ssl = true
    name = "pypi"

    [packages]
    django = ">=5.0"
    gunicorn = "*"

    [dev-packages]
    black = "==24.3.0"
    """
    deps = parse_pipfile(content, "Pipfile")
    names = [d.name for d in deps]

    assert "django" in names
    assert "gunicorn" in names
    assert "black" in names


def test_scan_manifests_in_directory():
    """Discovers and parses multiple manifests across directories."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        (root / "requirements.txt").write_text("requests==2.31.0\n", encoding="utf-8")
        (root / "package.json").write_text('{"dependencies": {"lodash": "^4.17.21"}}', encoding="utf-8")

        deps = scan_manifests_in_directory(root)
        names = [d.name for d in deps]
        assert "requests" in names
        assert "lodash" in names
