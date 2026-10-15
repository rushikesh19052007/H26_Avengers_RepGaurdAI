# DepGuard AI — Backend Service Documentation

DepGuard AI is an automated dependency resilience and modernization engine. It inspects repository manifests, extracts Python and JavaScript/TypeScript source-code usages via Abstract Syntax Tree (AST) analysis, and coordinates with Gemma 4 using the Google Gen AI SDK (with thinking enabled) to generate actionable migration recipes and exportable Dependency Exit Capsules.

---

## 1. Prerequisites

- **Operating System:** Windows 10/11, macOS, or Linux.
- **Python Version:** Python 3.12 or 3.13 (`python --version`).
- **Node.js:** Node.js v18+ and npm.
- **Google Gen AI API Key:** A Gemini API key from [Google AI Studio](https://aistudio.google.com/).

---

## 2. Windows Setup & Installation

### Step 1: Create a Python Virtual Environment

Open a PowerShell terminal in the repository root:

```powershell
python -m venv backend/.venv
```

Activate the virtual environment:

```powershell
backend\.venv\Scripts\Activate.ps1
```

*(If script execution is disabled on your system, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` first, or directly call `backend\.venv\Scripts\python.exe`)*

### Step 2: Install Backend Dependencies

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

### Step 3: Configure GEMINI_API_KEY Privately

Copy the template file:

```powershell
copy backend\.env.example backend\.env
```

Open `backend\.env` in an editor and insert your secret key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMMA_MODEL=gemma-4-31b-it
GEMMA_FALLBACK_MODEL=gemma-4-26b-a4b-it
GEMMA_THINKING_LEVEL=high
HOST=127.0.0.1
PORT=8000
```

> **Security Note:** `backend/.env` is ignored by `.gitignore`. Never commit API keys or secret environment variables to Git. The frontend never accesses `GEMINI_API_KEY` directly; all inference calls originate from the Python backend.

---

## 3. Hosted Gemini API & Gemma 4 Configuration

- **Primary Model:** `gemma-4-31b-it` (configured via `GEMMA_MODEL`).
- **Fallback Model:** `gemma-4-26b-a4b-it` (configured via `GEMMA_FALLBACK_MODEL`).
- **Thinking Mode:** Enabled using the official SDK configuration:
  ```python
  from google.genai import types
  config = types.GenerateContentConfig(
      thinking_config=types.ThinkingConfig(thinking_level="high"),
      response_mime_type="application/json"
  )
  ```
- **Network Requirements:** The backend makes outbound HTTPS requests to Google's hosted Gemini API endpoints (`generativelanguage.googleapis.com`). Ensure outbound network access on port 443 is permitted. Inference is executed securely on Google's hosted service (not local GPU execution).

---

## 4. Running the Applications

### Start the FastAPI Backend

In terminal 1:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

- **Health Ping:** http://127.0.0.1:8000/api/health
- **Interactive Swagger Docs:** http://127.0.0.1:8000/docs

### Start the Vite Frontend

In terminal 2:

```powershell
npm run dev
```

- **Dashboard:** http://localhost:3000/
- Requests to `/api/*` are automatically proxied to `http://127.0.0.1:8000`.

---

## 5. Running Automated Tests

### Run the Backend Pytest Suite

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

All standard unit tests mock external Gemini API calls to prevent consuming your API quota.

### Run Frontend Unit Tests

```powershell
npx tsx --test src/utils/scanLogic.test.ts
```

### Type Checking and Production Build

```powershell
npm run lint
npm run build
```

### Optional Live Gemma 4 Integration Test

To run an end-to-end inference verification against the hosted Google Gen AI API:

```powershell
$env:RUN_LIVE_GEMINI_TEST="true"
$env:GEMINI_API_KEY="your_actual_key"
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_live_gemma_integration.py -v
```

---

## 6. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, model info, and key configuration status (zero secrets exposed). |
| `POST` | `/api/repositories/validate` | Validates GitHub URLs or uploaded ZIP metadata. |
| `POST` | `/api/scans` | Initiates real repository scan (URL or multipart ZIP). |
| `GET` | `/api/scans/{scan_id}` | Returns genuine progress stages and execution state. |
| `GET` | `/api/scans/{scan_id}/results` | Returns completed scan findings, evidence, and Gemma 4 recommendations. |
| `GET` | `/api/scans/{scan_id}/capsule` | Downloads or exports Dependency Exit Capsule (`?format=json` or `?format=markdown`). |
| `POST` | `/api/scans/{scan_id}/verify` | Runs safe sandbox test suite verification. |

---

## 7. Troubleshooting

- **401 Unauthorized / Invalid Key:** Verify `GEMINI_API_KEY` in `backend/.env`. Check `GET /api/health` to confirm `api_key_configured: true`.
- **429 Resource Exhausted / Quota:** Check your Google AI Studio quota limits. The backend catches quota exhaustion and reports descriptive errors.
- **404 Model Not Found:** Verify `GEMMA_MODEL` in `backend/.env`. The backend automatically attempts fallback to `GEMMA_FALLBACK_MODEL`.
- **ZipSlip or Traversal Error:** DepGuard AI strictly enforces path containment (`os.path.commonpath`). Archives with relative path traversal (`../`) or symlinks are rejected for security.
