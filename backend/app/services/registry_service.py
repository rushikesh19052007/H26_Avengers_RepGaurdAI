"""Asynchronous Package Registry, OSV Security, and GitHub API service with SQLite caching."""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import httpx
from packaging.version import parse as parse_version
from packaging.specifiers import SpecifierSet

from app.config import settings
from app.db.database import SessionLocal
from app.db.models import RegistryCacheRecord

logger = logging.getLogger("depguard.registry")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RegistryService:
    """Fetches real package metadata, vulnerability advisories (OSV), and repository telemetry."""

    def __init__(self, cache_ttl_hours: int = 24):
        self.cache_ttl_hours = cache_ttl_hours
        self._semaphore = asyncio.Semaphore(5)

    def _get_from_cache(self, package_name: str, ecosystem: str) -> Optional[Dict[str, Any]]:
        norm_name = package_name.lower().replace("_", "-")
        db = SessionLocal()
        try:
            record = (
                db.query(RegistryCacheRecord)
                .filter(
                    RegistryCacheRecord.package_name == norm_name,
                    RegistryCacheRecord.ecosystem == ecosystem.lower(),
                )
                .first()
            )
            if record and record.expires_at > utcnow():
                return json.loads(record.data_json)
            return None
        except Exception as e:
            logger.debug("Registry cache read error: %s", e)
            return None
        finally:
            db.close()

    def _save_to_cache(self, package_name: str, ecosystem: str, data: Dict[str, Any]):
        norm_name = package_name.lower().replace("_", "-")
        db = SessionLocal()
        try:
            expires_at = utcnow() + timedelta(hours=self.cache_ttl_hours)
            record = (
                db.query(RegistryCacheRecord)
                .filter(
                    RegistryCacheRecord.package_name == norm_name,
                    RegistryCacheRecord.ecosystem == ecosystem.lower(),
                )
                .first()
            )
            if record:
                record.data_json = json.dumps(data)
                record.cached_at = utcnow()
                record.expires_at = expires_at
            else:
                record = RegistryCacheRecord(
                    package_name=norm_name,
                    ecosystem=ecosystem.lower(),
                    data_json=json.dumps(data),
                    cached_at=utcnow(),
                    expires_at=expires_at,
                )
                db.add(record)
            db.commit()
        except Exception as e:
            logger.debug("Registry cache write error: %s", e)
            db.rollback()
        finally:
            db.close()

    async def fetch_pypi_metadata(self, client: httpx.AsyncClient, package_name: str) -> Dict[str, Any]:
        """Fetch package metadata directly from PyPI JSON API."""
        url = f"https://pypi.org/pypi/{package_name}/json"
        try:
            resp = await client.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                info = data.get("info", {})
                releases = data.get("releases", {})
                latest_version = info.get("version", "")
                
                # Extract release date
                latest_release_date = None
                if latest_version and latest_version in releases and releases[latest_version]:
                    upload_time = releases[latest_version][0].get("upload_time_iso_8601")
                    if upload_time:
                        latest_release_date = upload_time

                # Check inactive classifier
                classifiers = info.get("classifiers", [])
                is_inactive = any("Development Status :: 7 - Inactive" in c for c in classifiers)

                # Check yanked status
                is_yanked = bool(info.get("yanked"))

                # Requires python specifier
                requires_python = info.get("requires_python")

                return {
                    "exists": True,
                    "latest_version": latest_version,
                    "latest_release_date": latest_release_date,
                    "is_inactive": is_inactive,
                    "is_yanked": is_yanked,
                    "requires_python": requires_python,
                    "project_urls": info.get("project_urls") or {},
                    "home_page": info.get("home_page") or "",
                    "summary": info.get("summary") or "",
                    "source_url": f"https://pypi.org/project/{package_name}/",
                }
            elif resp.status_code == 404:
                return {"exists": False, "error": "Not found on PyPI"}
            else:
                return {"exists": False, "error": f"PyPI HTTP {resp.status_code}"}
        except Exception as e:
            logger.warning("Error contacting PyPI for %s: %s", package_name, e)
            return {"exists": False, "error": str(e)}

    async def fetch_osv_vulnerabilities(self, client: httpx.AsyncClient, package_name: str, version: Optional[str] = None) -> List[Dict[str, Any]]:
        """Query Google's OSV.dev API for genuine CVE / GHSA security advisories."""
        url = "https://api.osv.dev/v1/query"
        payload: Dict[str, Any] = {
            "package": {"name": package_name, "ecosystem": "PyPI"}
        }
        if version and version not in ("latest", "unpinned", "*"):
            clean_ver = version.lstrip("=~><^")
            if clean_ver:
                payload["version"] = clean_ver

        try:
            resp = await client.post(url, json=payload, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                vulns = data.get("vulns", [])
                results = []
                for v in vulns:
                    vuln_id = v.get("id", "")
                    aliases = v.get("aliases", [])
                    cve_id = next((a for a in aliases if a.startswith("CVE-")), vuln_id)
                    summary = v.get("summary") or (v.get("details", "")[:120] if v.get("details") else "Security vulnerability")
                    fixed_versions = []
                    for affected in v.get("affected", []):
                        for r in affected.get("ranges", []):
                            for event in r.get("events", []):
                                if "fixed" in event:
                                    fixed_versions.append(event["fixed"])
                    results.append({
                        "id": vuln_id,
                        "cve_id": cve_id,
                        "summary": summary,
                        "fixed_versions": list(set(fixed_versions)),
                        "source_url": f"https://osv.dev/vulnerability/{vuln_id}",
                    })
                return results
            return []
        except Exception as e:
            logger.warning("Error querying OSV for %s: %s", package_name, e)
            return []

    async def fetch_github_telemetry(self, client: httpx.AsyncClient, repo_url: str) -> Optional[Dict[str, Any]]:
        """Fetch repository archived status and last push date if GitHub repository."""
        if "github.com/" not in repo_url:
            return None
        parts = repo_url.rstrip("/").split("github.com/")[-1].split("/")
        if len(parts) < 2:
            return None
        owner, repo = parts[0], parts[1].replace(".git", "")
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"

        try:
            resp = await client.get(api_url, headers=headers, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "is_archived": bool(data.get("archived")),
                    "pushed_at": data.get("pushed_at"),
                    "stars": data.get("stargazers_count", 0),
                    "open_issues": data.get("open_issues_count", 0),
                    "repo_url": data.get("html_url"),
                }
            return None
        except Exception as e:
            logger.debug("Error checking GitHub repo %s/%s: %s", owner, repo, e)
            return None

    async def get_package_intel(
        self,
        package_name: str,
        declared_version: Optional[str] = None,
        ecosystem: str = "pypi",
    ) -> Dict[str, Any]:
        """Returns comprehensive package intelligence with caching and error isolation."""
        cached = self._get_from_cache(package_name, ecosystem)
        if cached:
            return cached

        async with self._semaphore:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                if ecosystem.lower() == "pypi":
                    pypi_task = self.fetch_pypi_metadata(client, package_name)
                    osv_task = self.fetch_osv_vulnerabilities(client, package_name, declared_version)
                    pypi_data, osv_vulns = await asyncio.gather(pypi_task, osv_task)

                    github_telemetry = None
                    # Attempt GitHub check if repo URL is available in PyPI project_urls
                    if pypi_data.get("exists"):
                        urls = pypi_data.get("project_urls", {})
                        repo_candidate = None
                        for key in ("Source", "Repository", "Source Code", "Code", "GitHub", "Homepage"):
                            u = urls.get(key)
                            if u and "github.com/" in u:
                                repo_candidate = u
                                break
                        if not repo_candidate and "github.com/" in pypi_data.get("home_page", ""):
                            repo_candidate = pypi_data.get("home_page")

                        if repo_candidate:
                            github_telemetry = await self.fetch_github_telemetry(client, repo_candidate)

                    result = {
                        "package_name": package_name,
                        "ecosystem": "pypi",
                        "pypi": pypi_data,
                        "osv_vulnerabilities": osv_vulns,
                        "github": github_telemetry,
                        "fetched_at": utcnow().isoformat(),
                    }
                    self._save_to_cache(package_name, ecosystem, result)
                    return result
                else:
                    # Generic / npm fallback
                    return {
                        "package_name": package_name,
                        "ecosystem": ecosystem,
                        "pypi": {"exists": False},
                        "osv_vulnerabilities": [],
                        "github": None,
                        "fetched_at": utcnow().isoformat(),
                    }
