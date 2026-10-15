# DepGuard AI — Dependency Resilience Engine

> **Best Use of Gemma 4 — Hacktoberfest 2026**  
> An automated, production-grade dependency resilience engine that combines deterministic repository manifest scanning, deep Abstract Syntax Tree (AST) import graph analysis, and Gemma 4 AI reasoning with Thinking Mode enabled to generate migration plans, verification suites, and exportable Dependency Exit Capsules.

---

## 🌟 Key Features

- **Real-Time Deterministic Scanning:** Evaluates Python (`requirements.txt`, `pyproject.toml`, `Pipfile`) and JS/TS (`package.json`) manifests without running arbitrary untrusted scripts.
- **Deep AST Import Mapping:** Parses source code with Python's standard `ast` module to index real import occurrences, call sites, and affected files.
- **Gemma 4 Thinking Architecture:** Utilizes `google-genai` with `thinking_config=types.ThinkingConfig(thinking_level="high")` on `gemma-4-31b-it` (with explicit fallback to `gemma-4-26b-a4b-it`) to reason over bounded, structured evidence.
- **Zero Mock / Demo Fallbacks:** Pure production execution — requires a public GitHub repository URL or ZIP upload. Displays genuine findings or real empty states.
- **Dependency Exit Capsules:** Export audit reports in standardized JSON and Markdown formats containing observed facts, AI recommendations, and verification results.
- **Safe Sandboxing:** Strict ZipSlip and path traversal mitigation (`os.path.commonpath`), archive bomb protection, and controlled test execution.

---

## 🏗️ Architecture & Project Structure

```
├── backend/                  # Python 3.12+ FastAPI Service
│   ├── app/
│   │   ├── api/routes.py     # Health, Validate, Scans, Results, Capsule, Verify
│   │   ├── config.py         # Pydantic settings & dotenv loader
│   │   ├── main.py           # FastAPI application root & CORS
│   │   ├── schemas.py        # Pydantic schemas & Gemma structured output
│   │   └── services/
│   │       ├── capsule_service.py      # JSON & Markdown Exit Capsule generator
│   │       ├── dependency_analyzer.py  # Deterministic scanner + AI coordinator
│   │       ├── gemma_service.py        # Official google-genai Gemma 4 service
│   │       ├── manifest_parser.py      # requirements.txt, toml, package.json
│   │       ├── repository_service.py   # Safe ZIP extraction & GitHub fetcher
│   │       ├── usage_mapper.py         # Python AST and JS import mapping
│   │       └── verification_service.py # Controlled sandbox test runner
│   ├── tests/                # 25+ automated pytest suite
│   ├── requirements.txt
│   └── README.md
├── src/                      # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── components/           # UI Dashboard components & views
│   ├── services/api.ts       # Centralized typed API service connecting to backend
│   └── types/                # Strongly-typed schemas matching backend
├── vite.config.ts            # Vite dev proxy forwarding /api to http://127.0.0.1:8000
└── package.json
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python:** 3.12 or 3.13
- **Node.js:** v18+ and npm
- **Gemini API Key:** From [Google AI Studio](https://aistudio.google.com/)

---

### 2. Backend Setup

```powershell
# Create Python virtual environment
python -m venv backend/.venv

# Install dependencies
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Configure environment
copy backend\.env.example backend\.env
# Edit backend\.env to set GEMINI_API_KEY=your_key

# Start FastAPI backend server (port 8000)
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

- **Health check:** `http://127.0.0.1:8000/api/health`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup

In a new terminal:

```powershell
# Install frontend packages (if not already installed)
npm install

# Start Vite development server (port 3000)
npm run dev
```

Open **`http://localhost:3000/`** in your browser. All `/api` requests are automatically proxied to the FastAPI backend.

---

## 🧪 Testing

### Run Backend Tests (Pytest)
```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

### Run Frontend Tests
```powershell
npx tsx --test src/utils/scanLogic.test.ts
```

### Check Types & Build
```powershell
npm run lint
npm run build
```

---

## 📄 License

Apache-2.0 License. Built for Hacktoberfest 2026.
