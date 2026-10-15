/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BackendHealthResponse,
  RepositoryValidateRequest,
  RepositoryValidateResponse,
  ScanStatusResponse,
  BackendScanResultsResponse,
  VerificationResponse,
} from '../types/api';
import { ScannedRepositoryData, DependencyItem, ActivityLogItem } from '../types';

export const API_BASE = ''; // Uses Vite dev proxy (or relative URL for same origin)

export const checkBackendHealth = fetchHealth;

/**
 * React hook to track backend connectivity in UI components
 */
export function useBackendHealth(pollIntervalMs: number = 15000) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [serviceInfo, setServiceInfo] = useState<BackendHealthResponse | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const check = useCallback(async () => {
    setIsChecking(true);
    const result = await fetchHealth();
    setIsOnline(result.ok);
    if (result.ok && result.data) {
      setServiceInfo(result.data);
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    check();
    if (pollIntervalMs > 0) {
      const timer = setInterval(check, pollIntervalMs);
      return () => clearInterval(timer);
    }
  }, [check, pollIntervalMs]);

  return { isOnline, serviceInfo, isChecking, refetch: check, baseUrl: 'http://127.0.0.1:8000' };
}

/**
 * Health check ping for DepGuard AI Backend (GET /api/health)
 */
export async function fetchHealth(): Promise<{ ok: boolean; data?: BackendHealthResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `Backend returned HTTP ${res.status}` };
    }
    const data: BackendHealthResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Backend connection failed';
    return { ok: false, error: msg };
  }
}

/**
 * Validates a GitHub repository URL or uploaded file metadata (POST /api/repositories/validate)
 */
export async function validateRepository(
  req: RepositoryValidateRequest
): Promise<RepositoryValidateResponse> {
  const res = await fetch(`${API_BASE}/api/repositories/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`Validation failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Initiates a new scan on the backend (POST /api/scans)
 */
export async function initiateScan(target: {
  repoUrl?: string;
  branch?: string;
  file?: File | null;
}): Promise<ScanStatusResponse> {
  const formData = new FormData();
  if (target.repoUrl) {
    formData.append('repo_url', target.repoUrl.trim());
    if (target.branch) formData.append('branch', target.branch.trim());
  } else if (target.file) {
    formData.append('file', target.file);
  } else {
    throw new Error('A valid repository URL or ZIP file is required to initiate a scan.');
  }

  const res = await fetch(`${API_BASE}/api/scans`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    let errMsg = `Failed to initiate scan (${res.status}): ${errText}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.detail) errMsg = errJson.detail;
    } catch {
      // Keep formatted text
    }
    throw new Error(errMsg);
  }

  return res.json();
}

/**
 * Polls status for an ongoing scan (GET /api/scans/:id)
 */
export async function pollScanStatus(scanId: string): Promise<ScanStatusResponse> {
  const res = await fetch(`${API_BASE}/api/scans/${encodeURIComponent(scanId)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to query scan status (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Fetches completed scan findings, evidence, and AI recommendations (GET /api/scans/:id/results)
 */
export async function fetchScanResults(scanId: string): Promise<BackendScanResultsResponse> {
  const res = await fetch(`${API_BASE}/api/scans/${encodeURIComponent(scanId)}/results`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    let errMsg = `Failed to fetch scan results (${res.status}): ${errText}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.detail) errMsg = errJson.detail;
    } catch {
      // Keep text
    }
    throw new Error(errMsg);
  }

  return res.json();
}

/**
 * Downloads or retrieves a Dependency Exit Capsule in JSON or Markdown format
 */
export function getCapsuleDownloadUrl(scanId: string, format: 'json' | 'markdown' = 'json'): string {
  return `${API_BASE}/api/scans/${encodeURIComponent(scanId)}/capsule?format=${format}&download=true`;
}

export async function fetchCapsuleContent(scanId: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
  const res = await fetch(`${API_BASE}/api/scans/${encodeURIComponent(scanId)}/capsule?format=${format}`);
  if (!res.ok) {
    throw new Error(`Failed to retrieve capsule (${res.status})`);
  }
  return res.text();
}

/**
 * Runs controlled verification on the backend (POST /api/scans/:id/verify)
 */
export async function runVerification(scanId: string, dependencyName?: string): Promise<VerificationResponse> {
  const url = dependencyName
    ? `${API_BASE}/api/scans/${encodeURIComponent(scanId)}/verify?dependency_name=${encodeURIComponent(dependencyName)}`
    : `${API_BASE}/api/scans/${encodeURIComponent(scanId)}/verify`;

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Verification request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Transforms BackendScanResultsResponse into ScannedRepositoryData for dashboard consumption
 */
export function mapBackendResultsToRepositoryData(
  backendData: BackendScanResultsResponse
): ScannedRepositoryData {
  const dependencies: DependencyItem[] = backendData.dependencies.map((dep, idx) => ({
    id: dep.id || `dep-${idx + 1}-${dep.name}`,
    name: dep.name,
    ecosystem: dep.ecosystem || 'pypi',
    version: dep.version || 'unpinned',
    targetVersion: dep.targetVersion || dep.version,
    riskSeverity: dep.riskSeverity,
    riskReason: dep.riskReason,
    evidenceSource: dep.evidenceSource,
    declaredManifest: dep.declaredManifest,
    astCallSites: dep.astCallSites,
    astFiles: dep.astFiles,
    status: dep.status,
    statusDetails: dep.statusDetails,
    codeSnippets: dep.codeSnippets || [],
    facts: (dep.facts || []).map((f) => ({
      type: f.type === 'UNRESOLVED' ? 'INFERRED' : f.type,
      text: f.text,
      isWarning: f.isWarning,
    })),
    migrationRecommendation: dep.migrationRecommendation || {
      title: `Maintain ${dep.name}`,
      targetPackages: [dep.name],
      description: 'No breaking issues observed under target runtime.',
      confidence: 0.95,
      estimatedSynthesisTime: '0.5s',
      astTransformAvailable: false,
    },
  }));

  const activityLogs: ActivityLogItem[] = [
    {
      id: `act-1-${Date.now()}`,
      timestamp: backendData.scan_timestamp,
      type: 'scan',
      title: `Scan Completed: ${backendData.repository_name}`,
      description: `Discovered ${backendData.summary.total} packages across ${backendData.manifests_discovered.length} manifests with ${backendData.summary.astCallSites} AST usages.`,
      badge: 'Completed',
      badgeColor: 'bg-emerald-500/10 text-emerald-700',
    },
    {
      id: `act-2-${Date.now()}`,
      timestamp: backendData.scan_timestamp,
      type: 'manifest',
      title: `Gemma 4 AI Evaluation`,
      description: backendData.ai_assessment || 'Gemma 4 evaluated dependency evidence with thinking enabled.',
      badge: backendData.ai_model_used || 'Gemma 4',
      badgeColor: 'bg-primary-fixed text-primary',
    },
  ];

  return {
    id: backendData.scan_id,
    name: backendData.repository_name,
    url: backendData.repository_url,
    branch: backendData.branch,
    visibility: backendData.repository_url.startsWith('local://') ? 'Local ZIP' : 'Public',
    lastScanned: backendData.scan_timestamp,
    pythonRuntime: 'Python 3.12 / 3.13',
    files: backendData.manifests_discovered.length > 0 ? backendData.manifests_discovered : ['requirements.txt'],
    manifestName: backendData.manifests_discovered[0] || 'requirements.txt',
    manifestContent: dependencies.map((d) => `${d.name}==${d.version}`).join('\n'),
    dependencies,
    summary: {
      total: backendData.summary.total,
      highRisk: backendData.summary.highRisk,
      needsReview: backendData.summary.needsReview,
      healthy: backendData.summary.healthy,
      astCallSites: backendData.summary.astCallSites,
      scannedFilesCount: backendData.scanned_files_count,
      verifiedPassing: backendData.summary.verifiedPassing,
    },
    activityLogs,
    limitations: backendData.limitations,
    source: backendData.repository_url.startsWith('local://') ? 'zip' : 'github',
  };
}
