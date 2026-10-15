/**
 * Pure logic and calculations for DepGuard AI dependency scanner & resilience engine.
 * Decoupled from React UI components for deterministic unit-testing.
 */

export interface TrackedDependency {
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
  status: 'Verified' | 'Not tested' | 'Failed' | 'Pending';
  statusDetails?: string;
  codeSnippets?: {
    file: string;
    line: number;
    purpose: string;
    code: string;
  }[];
  migrationRecommendation?: {
    replacement: string;
    description: string;
    confidence: number;
    estimatedTime: string;
    astTransformAvailable: boolean;
  };
  facts: {
    type: 'OBSERVED' | 'INFERRED';
    isWarning?: boolean;
    text: string;
  }[];
}

export interface HealthBreakdown {
  total: number;
  healthyCount: number;
  healthyPct: number;
  needsReviewCount: number;
  needsReviewPct: number;
  highRiskCount: number;
  highRiskPct: number;
}

export function calculateHealthBreakdown<T extends { riskSeverity: string }>(
  totalCataloged: number,
  dependencies: T[]
): HealthBreakdown {
  const highRiskCount = dependencies.filter((d) => d.riskSeverity === 'High').length;
  const needsReviewCount = dependencies.filter((d) => d.riskSeverity === 'Needs Review').length;
  const healthyCount = Math.max(0, totalCataloged - highRiskCount - needsReviewCount);
  const total = Math.max(1, totalCataloged);

  return {
    total,
    healthyCount,
    healthyPct: Math.round((healthyCount / total) * 1000) / 10,
    needsReviewCount,
    needsReviewPct: Math.round((needsReviewCount / total) * 1000) / 10,
    highRiskCount,
    highRiskPct: Math.round((highRiskCount / total) * 1000) / 10,
  };
}

export function filterDependencies<
  T extends {
    name: string;
    evidenceSource: string;
    riskReason: string;
    declaredManifest: string;
    riskSeverity: string;
    status: string;
  }
>(
  deps: T[],
  searchQuery: string,
  riskFilter: string,
  evidenceFilter: string,
  statusFilter: string
): T[] {
  const query = searchQuery.trim().toLowerCase();

  return deps.filter((dep) => {
    // Search query matching name, manifest, evidence source, risk reason
    if (
      query &&
      !dep.name.toLowerCase().includes(query) &&
      !dep.evidenceSource.toLowerCase().includes(query) &&
      !dep.riskReason.toLowerCase().includes(query) &&
      !dep.declaredManifest.toLowerCase().includes(query)
    ) {
      return false;
    }

    // Risk Level filter
    if (riskFilter !== 'All Risks') {
      if (riskFilter.startsWith('High') && dep.riskSeverity !== 'High') return false;
      if (riskFilter.startsWith('Needs Review') && dep.riskSeverity !== 'Needs Review') return false;
      if (riskFilter.startsWith('Low') && dep.riskSeverity !== 'Low') return false;
    }

    // Evidence Source filter
    if (evidenceFilter !== 'All Evidence') {
      if (evidenceFilter.includes('AST') && !dep.evidenceSource.includes('py')) return false;
      if (evidenceFilter.includes('PyPI') && !dep.evidenceSource.includes('PyPI')) return false;
      if (evidenceFilter.includes('CVE') && !dep.riskReason.toLowerCase().includes('cve')) return false;
      if (evidenceFilter.includes('License') && !dep.riskReason.toLowerCase().includes('lic')) return false;
    }

    // Status filter
    if (statusFilter !== 'All Statuses') {
      if (statusFilter === 'Verified' && !dep.status.includes('Verified')) return false;
      if (statusFilter === 'Not tested' && dep.status !== 'Not tested') return false;
      if (statusFilter === 'Failed' && dep.status !== 'Failed') return false;
      if (statusFilter === 'Pending' && dep.status !== 'Pending') return false;
    }

    return true;
  });
}

export function getMigrationPlan(depName: string) {
  if (depName.toLowerCase() === 'urlwatch') {
    return {
      source: 'urlwatch==2.24',
      target: 'httpx + playwright-light',
      confidence: 94,
      astReplacements: 9,
      isCompatiblePy313: true,
      recipeSummary: 'Migrate to resilient asynchronous fetch hooks with zero runtime regressions.',
    };
  }
  if (depName.toLowerCase() === 'requests-cache') {
    return {
      source: 'requests-cache==0.9.1',
      target: 'requests-cache>=1.2.0',
      confidence: 98,
      astReplacements: 14,
      isCompatiblePy313: true,
      recipeSummary: 'Upgrade to modern connection pooling with safe thread-local SQLite backend.',
    };
  }
  return {
    source: depName,
    target: 'community-forked-v2',
    confidence: 89,
    astReplacements: 3,
    isCompatiblePy313: true,
    recipeSummary: 'Re-bind dynamic module import to modern wheel build with Python 3.12/3.13 support.',
  };
}
