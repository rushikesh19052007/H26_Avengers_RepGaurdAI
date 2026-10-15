"""Repository retrieval, validation, and safe unzipping service."""

import io
import os
import re
import shutil
import zipfile
import tempfile
from pathlib import Path
from typing import Tuple, Optional, Dict, Any, List
import httpx

from app.config import settings

# GitHub URL regex patterns
GITHUB_URL_REGEX = re.compile(
    r"^https?://github\.com/(?P<owner>[a-zA-Z0-9_.-]+)/(?P<repo>[a-zA-Z0-9_.-]+?)(?:\.git)?(?:/(?:tree|blob)/(?P<branch>[a-zA-Z0-9_./-]+))?/?$"
)
GITHUB_SHORTHAND_REGEX = re.compile(r"^(?P<owner>[a-zA-Z0-9_.-]+)/(?P<repo>[a-zA-Z0-9_.-]+)$")

# Ignored directory and file patterns
EXCLUDED_DIR_PATTERNS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    ".tox",
    ".mypy_cache",
    "dist",
    "build",
    ".idea",
    ".vscode",
    ".next",
    ".nuxt",
    ".output",
}

EXCLUDED_FILE_EXTENSIONS = {
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".pyc",
    ".pyo",
    ".pyd",
    ".iso",
    ".tar",
    ".gz",
    ".whl",
    ".zip",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".mp4",
    ".mp3",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}

# Max single file size to inspect (5 MB)
MAX_INSPECT_FILE_SIZE = 5 * 1024 * 1024


def validate_github_url(input_str: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str], List[str]]:
    """Validate GitHub repository URL or shorthand.
    Returns (is_valid, owner, repo, branch, error_messages).
    """
    errors: List[str] = []
    trimmed = (input_str or "").strip()
    if not trimmed:
        return False, None, None, None, ["Repository URL or shorthand is required."]

    # Prevent command injection, protocol injection, or local path smuggling
    if ".." in trimmed or "\\" in trimmed or ";" in trimmed or "|" in trimmed or "&" in trimmed:
        return False, None, None, None, ["Invalid characters in repository identifier."]

    match = GITHUB_URL_REGEX.match(trimmed)
    if match:
        owner = match.group("owner")
        repo = match.group("repo")
        branch = match.group("branch")
        return True, owner, repo, branch, []

    short_match = GITHUB_SHORTHAND_REGEX.match(trimmed)
    if short_match:
        owner = short_match.group("owner")
        repo = short_match.group("repo")
        return True, owner, repo, None, []

    return False, None, None, None, [
        f"Unsupported URL '{input_str}'. Supported format: https://github.com/owner/repository or owner/repository"
    ]


def safe_extract_zip(
    zip_bytes: bytes,
    target_dir: Path,
    max_files: Optional[int] = None,
    max_uncompressed_bytes: Optional[int] = None,
) -> List[Path]:
    """Safely extracts a ZIP archive preventing ZipSlip, archive bombs, and symlinks.
    Returns a list of extracted file paths.
    """
    max_files = max_files or settings.max_archive_files
    max_uncompressed_bytes = max_uncompressed_bytes or settings.max_uncompressed_bytes

    extracted_files: List[Path] = []
    total_uncompressed = 0
    total_files = 0
    target_dir_resolved = target_dir.resolve()

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for member in zf.infolist():
                total_files += 1
                if total_files > max_files:
                    raise ValueError(f"Archive exceeds maximum allowable file count ({max_files}). Possible zip bomb.")

                total_uncompressed += member.file_size
                if total_uncompressed > max_uncompressed_bytes:
                    raise ValueError(
                        f"Archive uncompressed size exceeds limit ({settings.max_uncompressed_size_mb} MB). Possible zip bomb."
                    )

                # Skip directories
                if member.is_dir() or member.filename.endswith("/"):
                    continue

                # Detect and reject symbolic links
                # Upper 16 bits of external_attr contain Unix file mode
                is_symlink = (member.external_attr >> 16) & 0o120000 == 0o120000
                if is_symlink:
                    # Skip symlinks for security
                    continue

                # Normalize member path
                clean_filename = member.filename.replace("\\", "/")
                # Strip leading slash or dot segments
                clean_filename = re.sub(r"^/+", "", clean_filename)

                # Check for ZipSlip / Path Traversal
                dest_path = (target_dir / clean_filename).resolve()
                try:
                    common = os.path.commonpath([str(target_dir_resolved), str(dest_path)])
                    if common != str(target_dir_resolved):
                        raise ValueError(f"ZipSlip detected in archive member: {member.filename}")
                except ValueError:
                    raise ValueError(f"Illegal path in archive member: {member.filename}")

                # Check if file path passes exclusion filters
                parts = Path(clean_filename).parts
                if any(part in EXCLUDED_DIR_PATTERNS for part in parts):
                    continue

                suffix = dest_path.suffix.lower()
                if suffix in EXCLUDED_FILE_EXTENSIONS:
                    continue

                # Ensure parent directory exists
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                # Extract file safely
                with zf.open(member) as source, open(dest_path, "wb") as target:
                    shutil.copyfileobj(source, target)

                extracted_files.append(dest_path)

    except zipfile.BadZipFile:
        raise ValueError("Invalid ZIP file or corrupted archive.")

    return extracted_files


async def fetch_github_repo_archive(
    owner: str,
    repo: str,
    branch: Optional[str] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> Tuple[bytes, Dict[str, Any]]:
    """Fetches public GitHub repository archive zipball and metadata.
    Returns (zip_bytes, metadata_dict).
    """
    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        should_close_client = True

    try:
        # 1. Fetch repo metadata
        meta_url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DepGuard-AI-Scanner/1.0",
        }
        res_meta = await client.get(meta_url, headers=headers)
        if res_meta.status_code == 404:
            raise ValueError(f"GitHub repository '{owner}/{repo}' not found or is private.")
        if res_meta.status_code == 403:
            raise ValueError("GitHub API rate limit exceeded. Please try again shortly.")
        if res_meta.status_code != 200:
            raise ValueError(f"Failed to query GitHub repository: HTTP {res_meta.status_code}")

        repo_info = res_meta.json()
        target_ref = branch or repo_info.get("default_branch") or "main"

        # 2. Fetch commit SHA for the target ref
        commit_sha: Optional[str] = None
        commit_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{target_ref}"
        res_commit = await client.get(commit_url, headers=headers)
        if res_commit.status_code == 200:
            commit_data = res_commit.json()
            commit_sha = commit_data.get("sha")

        # 3. Download zipball
        zip_url = f"https://api.github.com/repos/{owner}/{repo}/zipball/{target_ref}"
        res_zip = await client.get(zip_url, headers=headers)
        if res_zip.status_code != 200:
            raise ValueError(f"Failed to download repository zipball: HTTP {res_zip.status_code}")

        metadata = {
            "owner": owner,
            "repo": repo,
            "full_name": repo_info.get("full_name", f"{owner}/{repo}"),
            "html_url": repo_info.get("html_url", f"https://github.com/{owner}/{repo}"),
            "default_branch": repo_info.get("default_branch", "main"),
            "target_branch": target_ref,
            "commit_sha": commit_sha,
            "visibility": "Private" if repo_info.get("private") else "Public",
            "stars": repo_info.get("stargazers_count", 0),
        }

        return res_zip.content, metadata

    finally:
        if should_close_client:
            await client.aclose()
