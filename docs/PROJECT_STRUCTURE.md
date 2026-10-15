# DepGuard AI - Project Structure & Directory Layout

This document outlines the organization of the **DepGuard AI** repository.

```
depguard-ai---dependency-resilience-engine/
├── docs/                               # Project documentation and architecture guides
│   ├── ARCHITECTURE.md                 # System design and component interactions
│   └── PROJECT_STRUCTURE.md            # Directory map and module guide
├── src/                                # Application source code
│   ├── components/                     # React UI components & view pages
│   │   ├── ActivityLogsView.tsx        # Audit log and activity stream view
│   │   ├── DepGuardLogo.tsx            # SVG brand logo component
│   │   ├── DependencyRisksView.tsx     # Vulnerability and risk assessment view
│   │   ├── ExitCapsulesView.tsx        # Portability and capsule export view
│   │   ├── Header.tsx                  # Top application header with global actions
│   │   ├── LandingView.tsx             # Welcome screen and repository ingestion
│   │   ├── MigrationAssistantView.tsx  # AI migration diffs and compatibility planner
│   │   ├── OverviewView.tsx            # Central dashboard with risk scores
│   │   ├── QuickScanModal.tsx          # Fast on-demand dependency scan dialog
│   │   ├── RepositoryScannerView.tsx   # AST source mapping and dependency graph view
│   │   ├── ScanningProgressView.tsx    # Live pipeline progress animation view
│   │   ├── SettingsAndDocsView.tsx     # Engine configurations and reference documentation
│   │   ├── Sidebar.tsx                 # Navigation drawer and view switcher
│   │   └── TestVerificationView.tsx    # Test execution and validation view
│   ├── data/                           # Mock datasets and fixtures
│   │   └── mockData.ts                 # Sample dependencies, logs, and pipeline stages
│   ├── types/                          # TypeScript type definitions and interfaces
│   │   └── index.ts                    # Core workspace, dependency, and log types
│   ├── utils/                          # Pure helper functions and unit tests
│   │   ├── scanLogic.ts                # Filtering, scoring, and calculation logic
│   │   └── scanLogic.test.ts           # Unit tests for scanner utilities
│   ├── App.tsx                         # Root application controller and routing
│   ├── index.css                       # Global styles and Tailwind configuration
│   └── main.tsx                        # Vite React application entrypoint
├── .env.example                        # Example environment variables (GEMINI_API_KEY)
├── .gitignore                          # Git ignore rules for build and cache files
├── index.html                          # Single-page application HTML entrypoint
├── metadata.json                       # AI Studio project metadata and capabilities
├── package.json                        # Project dependencies and npm scripts
├── README.md                           # Quickstart and local setup guide
├── tsconfig.json                       # TypeScript compiler configuration
└── vite.config.ts                      # Vite build and development configuration
```

## Module Guide

### `src/components/`
Contains all user-facing views, layout elements, modals, and branding assets:
- **Navigation & Layout:** `Sidebar.tsx`, `Header.tsx`, `DepGuardLogo.tsx`
- **Primary Views:** `LandingView.tsx`, `ScanningProgressView.tsx`, `OverviewView.tsx`, `RepositoryScannerView.tsx`, `DependencyRisksView.tsx`, `MigrationAssistantView.tsx`, `TestVerificationView.tsx`, `ExitCapsulesView.tsx`, `ActivityLogsView.tsx`, `SettingsAndDocsView.tsx`
- **Modals:** `QuickScanModal.tsx`

### `src/data/`
Contains sample data fixtures (`mockData.ts`) used for development, previewing, and demonstrating scan analysis and migration flows.

### `src/types/`
Contains TypeScript definitions (`index.ts`) for all data models, including `DependencyItem`, `WorkspaceView`, `ActivityLogItem`, and `InspectionStage`.

### `src/utils/`
Contains decoupled business logic (`scanLogic.ts`) for dependency filtering, vulnerability scoring, and calculations, along with its test suite (`scanLogic.test.ts`).
