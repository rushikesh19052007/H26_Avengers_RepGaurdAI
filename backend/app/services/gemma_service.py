"""Gemma 4 integration using official Google Gen AI Python SDK with thinking enabled."""

import json
import logging
import re
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.config import settings
from app.schemas import GemmaAnalysisResponse, GemmaFinding

logger = logging.getLogger("depguard.gemma")


class GemmaServiceError(Exception):
    """Custom exception for Gemma service failures."""

    def __init__(self, message: str, status_code: int = 502, error_type: str = "GEMMA_ERROR"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_type = error_type


class GemmaService:
    """Service to run Gemma 4 dependency analysis with thinking mode."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.primary_model = settings.gemma_model
        self.fallback_model = settings.gemma_fallback_model
        self.thinking_level = settings.gemma_thinking_level

    def _get_client(self) -> genai.Client:
        if not self.api_key or len(self.api_key.strip()) < 5:
            raise GemmaServiceError(
                "GEMINI_API_KEY is not configured on the backend. Please set GEMINI_API_KEY in backend/.env.",
                status_code=401,
                error_type="API_KEY_MISSING",
            )
        return genai.Client(api_key=self.api_key)

    async def analyze_dependencies(
        self,
        repository_info: Dict[str, Any],
        manifests: List[str],
        dependencies_payload: List[Dict[str, Any]],
    ) -> GemmaAnalysisResponse:
        """Runs Gemma 4 analysis on the bounded structured evidence payload."""
        client = self._get_client()

        # Build structured prompt
        prompt = self._build_prompt(repository_info, manifests, dependencies_payload)

        # Configure thinking mode using official SDK types
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level=self.thinking_level),
            response_mime_type="application/json",
            temperature=0.2,
        )

        # Attempt with primary model, then explicit fallback if primary unavailable
        last_error: Optional[Exception] = None
        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        for model_id in models_to_try:
            try:
                logger.info("Invoking Gemma 4 model '%s' with thinking_level='%s'", model_id, self.thinking_level)
                response = client.models.generate_content(
                    model=model_id,
                    contents=prompt,
                    config=config,
                )

                response_text = response.text or ""
                return self._parse_and_validate_response(response_text)

            except APIError as api_err:
                last_error = api_err
                err_str = str(api_err)
                logger.warning("Gemma 4 model '%s' returned API error: %s", model_id, err_str)

                # Check if quota exceeded
                if "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower() or api_err.code == 429:
                    raise GemmaServiceError(
                        "Gemini API quota or rate limit exceeded. Please check your Google AI Studio quota.",
                        status_code=429,
                        error_type="QUOTA_EXCEEDED",
                    )
                # Check for invalid API key
                if "API_KEY_INVALID" in err_str or api_err.code in (401, 403):
                    raise GemmaServiceError(
                        "Provided GEMINI_API_KEY is invalid or unauthorized.",
                        status_code=401,
                        error_type="INVALID_API_KEY",
                    )
                # If model not found or unsupported, continue to fallback model
                if "NOT_FOUND" in err_str or api_err.code == 404 or "unsupported" in err_str.lower():
                    continue

                raise GemmaServiceError(
                    f"Gemini API request failed: {err_str}",
                    status_code=502,
                    error_type="API_ERROR",
                )

            except json.JSONDecodeError as json_err:
                logger.error("Failed to parse JSON response from Gemma: %s", json_err)
                raise GemmaServiceError(
                    "Gemma 4 output did not conform to valid JSON format.",
                    status_code=502,
                    error_type="MALFORMED_OUTPUT",
                )

            except Exception as e:
                logger.error("Unexpected error during Gemma inference: %s", e)
                last_error = e

        raise GemmaServiceError(
            f"Failed to generate analysis using Gemma models ({', '.join(models_to_try)}): {last_error}",
            status_code=502,
            error_type="MODEL_UNAVAILABLE",
        )

    def _build_prompt(
        self,
        repository_info: Dict[str, Any],
        manifests: List[str],
        dependencies_payload: List[Dict[str, Any]],
    ) -> str:
        """Constructs a bounded, evidence-grounded prompt for Gemma 4."""
        repo_name = repository_info.get("name", "Unknown repository")
        target_runtime = repository_info.get("target_runtime", "Python 3.12 / Python 3.13")

        # Bound dependencies payload to avoid context explosion
        bounded_deps = dependencies_payload[:30]

        return f"""You are DepGuard AI's dependency resilience engine.
Your task is to analyze discovered dependencies for the repository '{repo_name}' targeting modern {target_runtime}.

Ground Rules:
1. Analyze ONLY the supplied evidence below.
2. Distinguish observed programmatic facts from inferences.
3. Identify missing information and limitations.
4. Recommend replacement candidates ONLY when there is a plausible compatibility rationale.
5. Suggest actionable migration steps and test requirements.
6. AVOID claiming tests passed unless actual test execution output is provided.
7. AVOID inventing version numbers, CVE IDs, line numbers, or file names not in the evidence.
8. Output MUST strictly adhere to the requested JSON structure. Do NOT include markdown blocks or commentary.

Repository Manifests: {json.dumps(manifests)}
Discovered Evidence:
{json.dumps(bounded_deps, indent=2)}

Required JSON Response Schema:
{{
  "summary": "Concise 1-2 sentence overall dependency health summary",
  "findings": [
    {{
      "package_name": "package identifier exactly as declared",
      "risk_level": "critical | high | medium | low | unknown",
      "risk_category": "maintenance | compatibility | deprecation | ecosystem | other",
      "confidence": 0.95,
      "evidence": ["Observed evidence point 1", "Observed evidence point 2"],
      "affected_files": ["app.py"],
      "reasoning_summary": "Concise explanation grounded in evidence",
      "replacement_candidates": ["modern_package"],
      "migration_steps": ["Step 1: Install replacement", "Step 2: Update import statements"],
      "verification_requirements": ["Run pytest unit tests to verify zero regressions"],
      "limitations": ["Transitive dependencies were not deeply resolved"]
    }}
  ],
  "overall_assessment": "Comprehensive summary of upgrade path and breaking changes for Python 3.12/3.13",
  "unresolved_questions": ["Any information gaps or questions needing human investigation"]
}}
"""

    def _parse_and_validate_response(self, text: str) -> GemmaAnalysisResponse:
        """Cleans and validates the JSON model response using Pydantic."""
        cleaned = text.strip()
        # Strip markdown ```json ... ``` wrapper if model included it
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return GemmaAnalysisResponse.model_validate(data)
