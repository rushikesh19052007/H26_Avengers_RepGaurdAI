# DepGuard AI - System Architecture

**DepGuard AI** is a dependency resilience and vulnerability inspection engine designed to inspect dependencies, map Abstract Syntax Tree (AST) usage, and generate AI-assisted migration plans with verification.

---

## High-Level Architecture Flow

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────────────────┐
│  Repository Ingest  │ ──> │ Deep AST Code Search │ ──> │ Vulnerability & Risk   │
│ (GitHub / ZIP / AST)│     │ & Call Graph Mapping │     │ Score Assessment       │
└─────────────────────┘     └──────────────────────┘     └────────────────────────┘
                                                                     │
                                                                     ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────────────────┐
│   Exit Capsules     │ <── │ Test & Verification  │ <── │   Gemma 4 Migration    │
│ & Portability Export│     │ Automated Validation │     │ Assistant & Code Diffs │
└─────────────────────┘     └──────────────────────┘     └────────────────────────┘
```

---

## Core Pillars

### 1. Ingestion & Multi-Stage Scanner (`ScanningProgressView`)
- Parses dependency manifests (`package.json`, `requirements.txt`, `Pipfile`, `go.mod`).
- Sequentially executes 4 deterministic pipeline inspection stages:
  - **Stage 1:** Package manifest & lockfile parsing
  - **Stage 2:** Source AST reference scanning
  - **Stage 3:** Advisory & vulnerability correlation
  - **Stage 4:** Resilience report & capsule compilation

### 2. AST Source Graph Mapping (`RepositoryScannerView`)
- Maps real usage in application code directly to declared dependency imports.
- Distinguishes unused dependencies from deeply integrated APIs.
- Highlights exact file locations and call instances.

### 3. Vulnerability & Risk Engine (`DependencyRisksView`)
- Identifies critical CVEs, unmaintained packages, breaking API deprecations, and restrictive licensing issues.
- Categorizes dependencies by risk level (Critical, High, Medium, Low) and maintenance status.

### 4. AI-Powered Migration Assistant (`MigrationAssistantView`)
- Generates side-by-side migration diffs.
- Synthesizes shim layers, adapter patterns, and direct replacements for deprecated packages.

### 5. Test & Verification Engine (`TestVerificationView`)
- Runs regression tests, type-check sweeps, and compatibility suites against suggested migrations to guarantee non-breaking changes.

### 6. Exit Capsules (`ExitCapsulesView`)
- Bundles dependency migration recipes, AST references, and verification logs into portable standalone capsules for zero vendor lock-in.
