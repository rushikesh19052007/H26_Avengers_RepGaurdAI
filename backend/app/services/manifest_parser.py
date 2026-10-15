"""Deterministic manifest parsing for Python and JavaScript/TypeScript ecosystems."""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import tomllib  # Python 3.11+ standard library
except ImportError:
    import tomli as tomllib  # type: ignore


class ParsedManifestDependency:
    """Represents a discovered dependency declaration in a manifest."""

    def __init__(
        self,
        name: str,
        specifier: str,
        manifest_path: str,
        ecosystem: str = "pypi",
        category: str = "runtime",
        line_number: int = 1,
        is_direct: bool = True,
    ):
        self.name = name.strip()
        self.specifier = specifier.strip()
        self.manifest_path = manifest_path.replace("\\", "/")
        self.ecosystem = ecosystem
        self.category = category
        self.line_number = line_number
        self.is_direct = is_direct

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "specifier": self.specifier,
            "manifest_path": self.manifest_path,
            "ecosystem": self.ecosystem,
            "category": self.category,
            "line_number": self.line_number,
            "is_direct": self.is_direct,
        }


def parse_requirements_txt(content: str, rel_path: str) -> List[ParsedManifestDependency]:
    """Parse standard requirements.txt lines."""
    results: List[ParsedManifestDependency] = []
    lines = content.splitlines()

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        # Skip empty lines, comments, and flags
        if not line or line.startswith("#") or line.startswith("-") or line.startswith("--"):
            continue

        # Strip inline comments and environment markers
        cleaned = line.split("#")[0].strip()
        cleaned = cleaned.split(";")[0].strip()
        if not cleaned:
            continue

        # Ignore VCS URLs or paths
        if any(cleaned.startswith(p) for p in ["git+", "hg+", "svn+", "bzr+", "http://", "https://", "./", "../"]):
            continue

        # Regex to capture name and optional specifier: e.g. package==1.2.3, pkg>=2.0.0, pkg[extra]~=1.4
        match = re.match(r"^([a-zA-Z0-9_.-]+)(?:\[.*?\])?\s*([=><!~^].*)?$", cleaned)
        if match:
            pkg_name = match.group(1).lower()
            spec = (match.group(2) or "latest").strip()
            category = "development" if "dev" in rel_path.lower() or "test" in rel_path.lower() else "runtime"
            results.append(
                ParsedManifestDependency(
                    name=pkg_name,
                    specifier=spec,
                    manifest_path=rel_path,
                    ecosystem="pypi",
                    category=category,
                    line_number=idx,
                )
            )

    return results


def parse_pyproject_toml(content: str, rel_path: str) -> List[ParsedManifestDependency]:
    """Parse pyproject.toml [project.dependencies], [tool.poetry.dependencies], etc."""
    results: List[ParsedManifestDependency] = []
    try:
        data = tomllib.loads(content)
    except Exception:
        return results

    # 1. PEP 621: [project.dependencies]
    project = data.get("project", {})
    if isinstance(project, dict):
        dependencies = project.get("dependencies", [])
        if isinstance(dependencies, list):
            for dep in dependencies:
                if isinstance(dep, str):
                    # parse similar to requirements.txt entry
                    cleaned = dep.split(";")[0].strip()
                    m = re.match(r"^([a-zA-Z0-9_.-]+)(?:\[.*?\])?\s*([=><!~^].*)?$", cleaned)
                    if m:
                        results.append(
                            ParsedManifestDependency(
                                name=m.group(1).lower(),
                                specifier=(m.group(2) or "latest").strip(),
                                manifest_path=rel_path,
                                ecosystem="pypi",
                                category="runtime",
                            )
                        )

        # Optional / dev dependencies: [project.optional-dependencies]
        opt_deps = project.get("optional-dependencies", {})
        if isinstance(opt_deps, dict):
            for group_name, group_list in opt_deps.items():
                if isinstance(group_list, list):
                    for dep in group_list:
                        if isinstance(dep, str):
                            cleaned = dep.split(";")[0].strip()
                            m = re.match(r"^([a-zA-Z0-9_.-]+)(?:\[.*?\])?\s*([=><!~^].*)?$", cleaned)
                            if m:
                                results.append(
                                    ParsedManifestDependency(
                                        name=m.group(1).lower(),
                                        specifier=(m.group(2) or "latest").strip(),
                                        manifest_path=rel_path,
                                        ecosystem="pypi",
                                        category="optional" if "test" not in group_name else "development",
                                    )
                                )

    # 2. Poetry: [tool.poetry.dependencies] & [tool.poetry.group.*.dependencies]
    tool = data.get("tool", {})
    if isinstance(tool, dict):
        poetry = tool.get("poetry", {})
        if isinstance(poetry, dict):
            poetry_deps = poetry.get("dependencies", {})
            if isinstance(poetry_deps, dict):
                for pkg, spec in poetry_deps.items():
                    if pkg.lower() == "python":
                        continue
                    spec_str = spec if isinstance(spec, str) else spec.get("version", "latest") if isinstance(spec, dict) else "latest"
                    results.append(
                        ParsedManifestDependency(
                            name=pkg.lower(),
                            specifier=str(spec_str),
                            manifest_path=rel_path,
                            ecosystem="pypi",
                            category="runtime",
                        )
                    )

            # Poetry dev groups
            groups = poetry.get("group", {})
            if isinstance(groups, dict):
                for grp_name, grp_data in groups.items():
                    if isinstance(grp_data, dict):
                        g_deps = grp_data.get("dependencies", {})
                        if isinstance(g_deps, dict):
                            for pkg, spec in g_deps.items():
                                if pkg.lower() == "python":
                                    continue
                                spec_str = spec if isinstance(spec, str) else spec.get("version", "latest") if isinstance(spec, dict) else "latest"
                                results.append(
                                    ParsedManifestDependency(
                                        name=pkg.lower(),
                                        specifier=str(spec_str),
                                        manifest_path=rel_path,
                                        ecosystem="pypi",
                                        category="development",
                                    )
                                )

    return results


def parse_package_json(content: str, rel_path: str) -> List[ParsedManifestDependency]:
    """Parse package.json dependencies and devDependencies."""
    results: List[ParsedManifestDependency] = []
    try:
        data = json.loads(content)
    except Exception:
        return results

    if not isinstance(data, dict):
        return results

    runtime = data.get("dependencies", {})
    if isinstance(runtime, dict):
        for pkg, ver in runtime.items():
            results.append(
                ParsedManifestDependency(
                    name=pkg,
                    specifier=str(ver),
                    manifest_path=rel_path,
                    ecosystem="npm",
                    category="runtime",
                )
            )

    devs = data.get("devDependencies", {})
    if isinstance(devs, dict):
        for pkg, ver in devs.items():
            results.append(
                ParsedManifestDependency(
                    name=pkg,
                    specifier=str(ver),
                    manifest_path=rel_path,
                    ecosystem="npm",
                    category="development",
                )
            )

    return results


def parse_pipfile(content: str, rel_path: str) -> List[ParsedManifestDependency]:
    """Parse Pipfile [packages] and [dev-packages]."""
    results: List[ParsedManifestDependency] = []
    try:
        data = tomllib.loads(content)
    except Exception:
        return results

    packages = data.get("packages", {})
    if isinstance(packages, dict):
        for pkg, spec in packages.items():
            spec_str = spec if isinstance(spec, str) else spec.get("version", "latest") if isinstance(spec, dict) else "latest"
            results.append(
                ParsedManifestDependency(
                    name=pkg.lower(),
                    specifier=str(spec_str),
                    manifest_path=rel_path,
                    ecosystem="pypi",
                    category="runtime",
                )
            )

    dev_packages = data.get("dev-packages", {})
    if isinstance(dev_packages, dict):
        for pkg, spec in dev_packages.items():
            spec_str = spec if isinstance(spec, str) else spec.get("version", "latest") if isinstance(spec, dict) else "latest"
            results.append(
                ParsedManifestDependency(
                    name=pkg.lower(),
                    specifier=str(spec_str),
                    manifest_path=rel_path,
                    ecosystem="pypi",
                    category="development",
                )
            )

    return results


def scan_manifests_in_directory(root_dir: Path) -> List[ParsedManifestDependency]:
    """Walks the repository directory and parses all recognized manifest files."""
    dependencies: List[ParsedManifestDependency] = []
    seen: set = set()

    # Prioritized manifest patterns
    manifest_names = {
        "requirements.txt",
        "requirements-dev.txt",
        "requirements.in",
        "pyproject.toml",
        "pipfile",
        "package.json",
    }

    for file_path in root_dir.rglob("*"):
        if not file_path.is_file():
            continue

        lower_name = file_path.name.lower()
        if lower_name not in manifest_names and not lower_name.startswith("requirements"):
            continue

        # Skip paths inside vendor / node_modules / git
        rel_path = file_path.relative_to(root_dir).as_posix()
        parts = rel_path.split("/")
        if any(p in EXCLUDED_MANIFEST_DIRS for p in parts):
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        parsed: List[ParsedManifestDependency] = []
        if lower_name.endswith(".toml"):
            parsed = parse_pyproject_toml(content, rel_path)
        elif lower_name == "package.json":
            parsed = parse_package_json(content, rel_path)
        elif lower_name == "pipfile":
            parsed = parse_pipfile(content, rel_path)
        elif "requirements" in lower_name:
            parsed = parse_requirements_txt(content, rel_path)

        for dep in parsed:
            key = (dep.name.lower(), dep.manifest_path)
            if key not in seen:
                seen.add(key)
                dependencies.append(dep)

    return dependencies


EXCLUDED_MANIFEST_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
    ".tox",
    ".pytest_cache",
}
