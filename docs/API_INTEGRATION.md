# DepGuard AI - Frontend & Backend Integration Spec

This guide documents the integration between the **DepGuard AI Frontend** (Vite + React) and the **DepGuard AI Backend Service** (FastAPI / Python engine on port 8000).

---

## 1. Connection & Endpoints Overview

| Property | Details |
| :--- | :--- |
| **Base URL** | `http://localhost:8000` (or `http://127.0.0.1:8000`) |
| **Interactive Docs** | [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs) (Swagger UI) |
| **GET `/api/health`** | Health check ping. Returns `{"status": "ok", "service": "DepGuard AI"}` |
| **POST `/api/scan`** | Analyzes the local checked-out repository and returns full dependency findings |
| **POST `/api/scan-zip`** | Accepts a zipped repo via `multipart/form-data` with field name `file` (max 10MB upload, max 50MB uncompressed) |

---

## 2. Environment Configuration

The frontend dynamically resolves configuration from `.env` or `.env.local`:

```env
# Gemini API Key (Configured privately in backend/.env)
GEMINI_API_KEY="your_gemini_api_key_here"

# DepGuard AI Backend Service URL
VITE_API_BASE_URL="http://localhost:8000"
APP_URL="http://localhost:3000"
```

---

## 3. Frontend Service Architecture

The frontend integration lives in `src/services/depguardApi.ts`:

- **`checkBackendHealth()`**: Periodically checks `GET /api/health` to update the connection pill in the header.
- **`useBackendHealth()`**: React hook providing `{ isOnline, serviceInfo, isChecking, refetch, baseUrl }`.
- **`scanLocalRepository()`**: Initiates `POST /api/scan` with `Accept: application/json`.
- **`scanZipArchive(file: File)`**: Validates file size (max 10MB) and sends multipart `FormData` with field `file` to `POST /api/scan-zip`.
- **`adaptApiScanToDependencies(response)`**: Converts raw backend response (`summary`, `dependencies`, `imports`, `limitations`) into the UI's `DependencyItem[]` contract.
- **`executeResilientScan(file)`**: Resilient pipeline runner that automatically falls back to deterministic local mock data if the backend is temporarily unreachable.

---

## 4. Expected Backend Response Contract

### `POST /api/scan` & `POST /api/scan-zip`

```json
{
  "summary": {
    "total_dependencies": 38,
    "vulnerable_dependencies": 4,
    "critical_risks": 1,
    "high_risks": 2,
    "ast_call_sites": 142,
    "resilience_score": 78,
    "scanned_files": 47,
    "target_runtime": "Python 3.12/3.13"
  },
  "dependencies": [
    {
      "name": "urlwatch",
      "version": "2.24",
      "target_version": "httpx>=0.28.0",
      "ecosystem": "pypi",
      "risk_severity": "High",
      "risk_reason": "Lacks Python 3.13 wheel & depends on deprecated distutils module.",
      "manifest": "requirements.txt",
      "call_sites": 9,
      "files_count": 2,
      "status": "Verified",
      "code_snippets": [
        {
          "file": "linkwatch/worker.py",
          "line": 44,
          "purpose": "JobHandler initialization",
          "code": "from urlwatch.handler import JobHandler\nhandler = JobHandler(config)"
        }
      ],
      "migration_recommendation": {
        "title": "Migrate to modern resilient asynchronous fetch hooks",
        "target_packages": ["httpx", "playwright-light"],
        "confidence": 0.98,
        "estimated_synthesis_time": "1.2s",
        "ast_transform_available": true,
        "diff_snippet": {
          "original": "- from urlwatch.handler import JobHandler",
          "replacement": "+ from linkwatch.resilience import ResilientFetchHook"
        }
      }
    }
  ],
  "imports": [
    {
      "file": "linkwatch/worker.py",
      "line": 44,
      "symbol": "JobHandler",
      "module": "urlwatch.handler",
      "code": "from urlwatch.handler import JobHandler",
      "is_vulnerable": true
    }
  ],
  "limitations": [
    "C-extension binary analysis skipped for 3.14 alpha compatibility."
  ]
}
```

---

## 5. Backend Teammate CORS Requirement

To allow the frontend (`http://localhost:3000` or `http://127.0.0.1:3000`) to communicate seamlessly with FastAPI:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DepGuard AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
