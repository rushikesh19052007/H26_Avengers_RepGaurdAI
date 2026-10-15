"""Configuration management for DepGuard AI Backend."""

import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv

# Search for .env in current directory or backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv(find_dotenv(usecwd=True))


class Settings(BaseModel):
    """Application configuration settings."""

    # Gemini & Gemma 4 Configuration
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemma_model: str = os.getenv("GEMMA_MODEL", "gemma-4-31b-it")
    gemma_fallback_model: str = os.getenv("GEMMA_FALLBACK_MODEL", "gemma-4-26b-a4b-it")
    gemma_thinking_level: str = os.getenv("GEMMA_THINKING_LEVEL", "high")

    # Server settings
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Database & Persistence
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/depguard.db")

    # Target Python environments & risk thresholds
    target_pythons: str = os.getenv("TARGET_PYTHONS", "3.12,3.13")
    stale_months_threshold: int = int(os.getenv("STALE_MONTHS_THRESHOLD", "24"))
    github_token: str = os.getenv("GITHUB_TOKEN", "")

    # Safety & Limits
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    max_uncompressed_size_mb: int = int(os.getenv("MAX_UNCOMPRESSED_SIZE_MB", "60"))
    max_archive_files: int = int(os.getenv("MAX_ARCHIVE_FILES", "1000"))
    scan_timeout_seconds: int = int(os.getenv("SCAN_TIMEOUT_SECONDS", "120"))

    @property
    def has_gemini_key(self) -> bool:
        """Check if Gemini API Key is configured."""
        return bool(self.gemini_api_key and len(self.gemini_api_key.strip()) > 5)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def max_uncompressed_bytes(self) -> int:
        return self.max_uncompressed_size_mb * 1024 * 1024


settings = Settings()
