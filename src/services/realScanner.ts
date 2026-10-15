/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScannedRepositoryData } from '../types';
import {
  initiateScan,
  pollScanStatus,
  fetchScanResults,
  mapBackendResultsToRepositoryData,
} from './api';

/**
 * Universal repository scan dispatcher using DepGuard AI backend API.
 */
export async function executeRealRepositoryScan(
  target: { repoUrl?: string; file?: File | null }
): Promise<ScannedRepositoryData> {
  // 1. Initiate real scan on backend
  const initRes = await initiateScan({
    repoUrl: target.repoUrl,
    file: target.file,
  });

  const scanId = initRes.scan_id;

  // 2. Poll until completion or failure (max 120s timeout)
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const statusRes = await pollScanStatus(scanId);

    if (statusRes.status === 'completed') {
      const results = await fetchScanResults(scanId);
      return mapBackendResultsToRepositoryData(results);
    }

    if (statusRes.status === 'failed') {
      throw new Error(statusRes.error || 'Repository scan failed on backend.');
    }
  }

  throw new Error('Scan timed out waiting for backend analysis.');
}
