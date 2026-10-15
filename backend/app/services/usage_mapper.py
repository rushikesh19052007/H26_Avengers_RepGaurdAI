"""Source-code usage mapper using Python AST and JS/TS scanner."""

import ast
import re
from pathlib import Path
from typing import Dict, List, Set, Any, Optional, Tuple

# Well-known PyPI package name to top-level Python import name mappings
PYPI_TO_IMPORT_MAP: Dict[str, List[str]] = {
    "beautifulsoup4": ["bs4"],
    "pyyaml": ["yaml"],
    "pillow": ["PIL"],
    "scikit-learn": ["sklearn"],
    "opencv-python": ["cv2"],
    "protobuf": ["google.protobuf"],
    "google-api-python-client": ["googleapiclient"],
    "pydantic-settings": ["pydantic_settings"],
    "python-dateutil": ["dateutil"],
    "python-multipart": ["multipart"],
    "python-dotenv": ["dotenv"],
    "setuptools": ["setuptools", "distutils", "pkg_resources"],
    "typing-extensions": ["typing_extensions"],
    "psycopg2-binary": ["psycopg2"],
    "mysqlclient": ["MySQLdb"],
}

EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
    ".tox",
    ".pytest_cache",
    "docs",
}


class CodeUsageOccurrence:
    def __init__(
        self,
        package_name: str,
        file_path: str,
        line_number: int,
        code_snippet: str,
        purpose: str = "Import statement",
        kind: str = "import",  # import, call, attribute, monkey_patch, config
    ):
        self.package_name = package_name
        self.file_path = file_path.replace("\\", "/")
        self.line_number = line_number
        self.code_snippet = code_snippet
        self.purpose = purpose
        self.kind = kind

    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_name": self.package_name,
            "file": self.file_path,
            "line": self.line_number,
            "code": self.code_snippet,
            "purpose": self.purpose,
            "kind": self.kind,
        }


def _get_attribute_chain(node: ast.AST) -> List[str]:
    """Helper to unfold attribute access e.g. a.b.c -> ['a', 'b', 'c']"""
    parts = []
    curr = node
    while isinstance(curr, ast.Attribute):
        parts.append(curr.attr)
        curr = curr.value
    if isinstance(curr, ast.Name):
        parts.append(curr.id)
    return list(reversed(parts))


def extract_python_imports(content: str, rel_path: str) -> List[CodeUsageOccurrence]:
    """Parse Python source file with standard ast module to extract imports, calls, attribute lookups, and monkey-patches."""
    occurrences: List[CodeUsageOccurrence] = []
    lines = content.splitlines()

    try:
        tree = ast.parse(content, filename=rel_path)
    except SyntaxError:
        # Fallback to regex if file has Python syntax error
        return extract_python_imports_regex(lines, rel_path)

    # Track locally bound symbols -> package name
    bound_symbols: Dict[str, str] = {}
    seen_sites: Set[Tuple[str, int, str]] = set()  # (package, line, kind)

    # Pass 1: Collect imports
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            line_no = getattr(node, "lineno", 1)
            code_line = lines[line_no - 1].strip() if line_no <= len(lines) else "import ..."
            for alias in node.names:
                root_module = alias.name.split(".")[0]
                bound_as = alias.asname or root_module
                bound_symbols[bound_as] = root_module
                site_key = (root_module, line_no, "import")
                if site_key not in seen_sites:
                    seen_sites.add(site_key)
                    occurrences.append(
                        CodeUsageOccurrence(
                            package_name=root_module,
                            file_path=rel_path,
                            line_number=line_no,
                            code_snippet=code_line,
                            purpose=f"Direct import of module '{alias.name}'",
                            kind="import",
                        )
                    )

        elif isinstance(node, ast.ImportFrom):
            line_no = getattr(node, "lineno", 1)
            code_line = lines[line_no - 1].strip() if line_no <= len(lines) else "from ... import ..."
            if node.module:
                root_module = node.module.split(".")[0]
                imported_names = ", ".join(a.name for a in node.names[:3])
                for alias in node.names:
                    bound_name = alias.asname or alias.name
                    bound_symbols[bound_name] = root_module

                site_key = (root_module, line_no, "import")
                if site_key not in seen_sites:
                    seen_sites.add(site_key)
                    occurrences.append(
                        CodeUsageOccurrence(
                            package_name=root_module,
                            file_path=rel_path,
                            line_number=line_no,
                            code_snippet=code_line,
                            purpose=f"Import symbols [{imported_names}] from '{node.module}'",
                            kind="import",
                        )
                    )

    if not bound_symbols:
        return occurrences

    # Pass 2: Trace monkey-patching, calls, and attribute lookups
    for node in ast.walk(tree):
        line_no = getattr(node, "lineno", 1)
        code_line = lines[line_no - 1].strip() if line_no <= len(lines) else ""

        # 2a. Detect monkey patching in assignments (e.g. requests.Session.request = _request)
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Attribute):
                    chain = _get_attribute_chain(target)
                    if chain and chain[0] in bound_symbols:
                        pkg = bound_symbols[chain[0]]
                        target_str = ".".join(chain)
                        site_key = (pkg, line_no, "monkey_patch")
                        if site_key not in seen_sites:
                            seen_sites.add(site_key)
                            occurrences.append(
                                CodeUsageOccurrence(
                                    package_name=pkg,
                                    file_path=rel_path,
                                    line_number=line_no,
                                    code_snippet=code_line,
                                    purpose=f"Monkey patch assignment to '{target_str}'",
                                    kind="monkey_patch",
                                )
                            )

        # 2b. Detect call sites (e.g. session.get(), requests.get(), Environment())
        elif isinstance(node, ast.Call):
            chain = _get_attribute_chain(node.func)
            if chain and chain[0] in bound_symbols:
                pkg = bound_symbols[chain[0]]
                call_target = ".".join(chain)
                site_key = (pkg, line_no, "call")
                if site_key not in seen_sites:
                    seen_sites.add(site_key)
                    occurrences.append(
                        CodeUsageOccurrence(
                            package_name=pkg,
                            file_path=rel_path,
                            line_number=line_no,
                            code_snippet=code_line,
                            purpose=f"Call site: {call_target}()",
                            kind="call",
                        )
                    )

        # 2c. Detect attribute lookups (e.g. requests.utils._parse_content_type_header)
        elif isinstance(node, ast.Attribute):
            chain = _get_attribute_chain(node)
            if len(chain) > 1 and chain[0] in bound_symbols:
                pkg = bound_symbols[chain[0]]
                attr_target = ".".join(chain)
                # Especially flag private attribute access or deep accesses
                if any(part.startswith("_") for part in chain[1:]):
                    site_key = (pkg, line_no, "attribute")
                    if site_key not in seen_sites:
                        seen_sites.add(site_key)
                        occurrences.append(
                            CodeUsageOccurrence(
                                package_name=pkg,
                                file_path=rel_path,
                                line_number=line_no,
                                code_snippet=code_line,
                                purpose=f"Private/internal attribute access '{attr_target}'",
                                kind="attribute",
                            )
                        )

    return occurrences


def extract_python_imports_regex(lines: List[str], rel_path: str) -> List[CodeUsageOccurrence]:
    """Regex fallback for extracting imports from unparseable Python files."""
    occurrences: List[CodeUsageOccurrence] = []
    import_re = re.compile(r"^(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))")

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        match = import_re.match(stripped)
        if match:
            mod = match.group(1) or match.group(2)
            root_mod = mod.split(".")[0]
            occurrences.append(
                CodeUsageOccurrence(
                    package_name=root_mod,
                    file_path=rel_path,
                    line_number=idx,
                    code_snippet=stripped,
                    purpose=f"Regex detected import of '{mod}'",
                )
            )

    return occurrences


def extract_javascript_imports(content: str, rel_path: str) -> List[CodeUsageOccurrence]:
    """Extract ES module imports and require statements from JS/TS code."""
    occurrences: List[CodeUsageOccurrence] = []
    lines = content.splitlines()

    # Matches:
    # import x from 'pkg'
    # import { a, b } from "pkg"
    # const x = require('pkg')
    es_import_re = re.compile(r"""(?:import\s+.*?from\s+['"]([@a-zA-Z0-9_./-]+)['"]|require\(['"]([@a-zA-Z0-9_./-]+)['"]\))""")

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*"):
            continue

        match = es_import_re.search(stripped)
        if match:
            pkg_target = match.group(1) or match.group(2)
            if pkg_target and not pkg_target.startswith("."):
                # Scope packages e.g. @tailwindcss/vite -> @tailwindcss/vite
                # Regular packages e.g. react/jsx-runtime -> react
                root_pkg = pkg_target.split("/")[0] if not pkg_target.startswith("@") else "/".join(pkg_target.split("/")[:2])
                occurrences.append(
                    CodeUsageOccurrence(
                        package_name=root_pkg,
                        file_path=rel_path,
                        line_number=idx,
                        code_snippet=stripped,
                        purpose=f"JavaScript/TypeScript import of '{pkg_target}'",
                    )
                )

    return occurrences


def map_usages_in_directory(root_dir: Path, max_files_scanned: int = 250) -> Dict[str, List[CodeUsageOccurrence]]:
    """Scans all source files in directory and indexes usage occurrences by package name."""
    usages_by_pkg: Dict[str, List[CodeUsageOccurrence]] = {}
    files_scanned = 0

    for file_path in root_dir.rglob("*"):
        if files_scanned >= max_files_scanned:
            break

        if not file_path.is_file():
            continue

        rel_path = file_path.relative_to(root_dir).as_posix()
        parts = rel_path.split("/")
        if any(p in EXCLUDED_DIRS for p in parts):
            continue

        suffix = file_path.suffix.lower()
        if suffix not in {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}:
            continue

        files_scanned += 1
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        if suffix == ".py":
            file_usages = extract_python_imports(content, rel_path)
        else:
            file_usages = extract_javascript_imports(content, rel_path)

        for occurrence in file_usages:
            key = occurrence.package_name.lower().replace("-", "_")
            if key not in usages_by_pkg:
                usages_by_pkg[key] = []
            usages_by_pkg[key].append(occurrence)

    return usages_by_pkg


def get_usages_for_package(
    package_name: str, usages_by_pkg: Dict[str, List[CodeUsageOccurrence]]
) -> List[CodeUsageOccurrence]:
    """Finds all code usages for a declared package name considering aliasing."""
    norm_name = package_name.lower().replace("-", "_")
    candidates = [norm_name]

    # Check mapping table
    if package_name.lower() in PYPI_TO_IMPORT_MAP:
        for mapped in PYPI_TO_IMPORT_MAP[package_name.lower()]:
            candidates.append(mapped.lower().replace("-", "_"))

    found: List[CodeUsageOccurrence] = []
    seen_sites: Set[str] = set()

    for cand in candidates:
        if cand in usages_by_pkg:
            for occ in usages_by_pkg[cand]:
                site_key = f"{occ.file_path}:{occ.line_number}"
                if site_key not in seen_sites:
                    seen_sites.add(site_key)
                    found.append(occ)

    return found
