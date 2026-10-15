/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackendHealthResponse {
  status: string;
  version: string;
  service?: string;
  model: string;
  fallback_model: string;
  thinking_level: string;
  api_key_configured: boolean;
  environment: string;
}

export interface RepositoryValidateRequest {
  repo_url?: string;
  file_name?: string;
  file_size_bytes?: number;
}

export interface RepositoryValidateResponse {
  valid: boolean;
  repo_type?: 'github' | 'zip';
  owner?: string;
  repo_name?: string;
  resolved_url?: string;
  errors: string[];
}

export interface ScanStageItem {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: string;
  completed_at?: string;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  current_stage: string;
  progress_percent: number;
  stages: ScanStageItem[];
  error?: string;
}

export interface BackendDiscoveredDependency {
  id: string;
  name: string;
  ecosystem: string;
  version: string;
  targetVersion?: string;
  riskSeverity: 'High' | 'Needs Review' | 'Low';
  riskReason: string;
  evidenceSource: string;
  declaredManifest: string;
  astCallSites: number;
  astFiles: number;
  status: 'Verified' | 'Failed' | 'Not tested';
  statusDetails?: string;
  codeSnippets: {
    file: string;
    line: number;
    purpose: string;
    code: string;
  }[];
  facts: {
    type: 'OBSERVED' | 'INFERRED' | 'UNRESOLVED';
    text: string;
    isWarning?: boolean;
    source?: string;
  }[];
  migrationRecommendation?: {
    title: string;
    targetPackages: string[];
    description: string;
    confidence: number;
    estimatedSynthesisTime: string;
    astTransformAvailable: boolean;
    diffSnippet: {
      original: string;
      replacement: string;
    };
  };
  aiConfidence?: number;
  isDirect?: boolean;
}

export interface BackendScanResultsResponse {
  scan_id: string;
  repository_name: string;
  repository_url: string;
  branch: string;
  commit_sha?: string;
  scan_timestamp: string;
  manifests_discovered: string[];
  scanned_files_count: number;
  dependencies: BackendDiscoveredDependency[];
  summary: {
    total: number;
    highRisk: number;
    needsReview: number;
    healthy: number;
    astCallSites: number;
    scannedFilesCount: number;
    verifiedPassing: number;
  };
  ai_assessment?: string;
  ai_model_used?: string;
  verification_summary?: {
    test_framework?: string;
    status?: string;
    executed_command?: string;
    duration_seconds?: number;
    stdout_summary?: string;
    compatibility_gaps?: string[];
  };
  limitations?: string[];
}

export interface VerificationResponse {
  scan_id: string;
  test_framework: string;
  executed_command?: string;
  exit_code?: number;
  duration_seconds: number;
  status: 'passed' | 'failed' | 'skipped';
  stdout_summary: string;
  compatibility_gaps: string[];
  sandbox_isolated: boolean;
}

// Backward-compatibility aliases for existing imports
export type ApiHealthResponse = BackendHealthResponse;
export type ApiScanResponse = BackendScanResultsResponse;
export type ApiDependency = BackendDiscoveredDependency;
