import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHealthBreakdown,
  filterDependencies,
  getMigrationPlan,
  type TrackedDependency,
} from './scanLogic.ts';

const mockDeps: TrackedDependency[] = [
  {
    id: 'urlwatch',
    name: 'urlwatch',
    ecosystem: 'PyPI (Python)',
    version: '2.24',
    riskSeverity: 'High',
    riskReason: 'Upstream unmaintained (>24 mo), setup.py distutils syntax error',
    evidenceSource: 'worker.py:44',
    declaredManifest: 'requirements.txt:14',
    astCallSites: 9,
    astFiles: 2,
    status: 'Failed',
    facts: [
      { type: 'OBSERVED', text: 'Manifest lock pins exact requirement urlwatch==2.24' },
      { type: 'OBSERVED', isWarning: true, text: 'No module named distutils' },
    ],
  },
  {
    id: 'requests-cache',
    name: 'requests-cache',
    ecosystem: 'PyPI (Python)',
    version: '0.9.1',
    riskSeverity: 'Needs Review',
    riskReason: 'SQLite backend hook deprecated',
    evidenceSource: 'storage.py:82',
    declaredManifest: 'requirements.txt:18',
    astCallSites: 14,
    astFiles: 1,
    status: 'Verified',
    facts: [{ type: 'OBSERVED', text: 'Deprecated hook' }],
  },
  {
    id: 'beautifulsoup4',
    name: 'beautifulsoup4',
    ecosystem: 'PyPI (Python)',
    version: '4.12.3',
    riskSeverity: 'Low',
    riskReason: 'Up to date, verified clean',
    evidenceSource: 'parser.py:15',
    declaredManifest: 'requirements.txt:22',
    astCallSites: 22,
    astFiles: 3,
    status: 'Verified',
    facts: [],
  },
];

test('calculateHealthBreakdown calculates percentages correctly', () => {
  const result = calculateHealthBreakdown(38, mockDeps);
  assert.equal(result.total, 38);
  assert.equal(result.highRiskCount, 1);
  assert.equal(result.needsReviewCount, 1);
  assert.equal(result.healthyCount, 36);
  assert.equal(typeof result.healthyPct, 'number');
});

test('filterDependencies filters by search query and severity', () => {
  const searchResult = filterDependencies(mockDeps, 'worker', 'All Risks', 'All Evidence', 'All Statuses');
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].name, 'urlwatch');

  const highOnly = filterDependencies(mockDeps, '', 'High (2)', 'All Evidence', 'All Statuses');
  assert.equal(highOnly.length, 1);
  assert.equal(highOnly[0].riskSeverity, 'High');
});

test('getMigrationPlan returns valid migration target for urlwatch', () => {
  const plan = getMigrationPlan('urlwatch');
  assert.equal(plan.target, 'httpx + playwright-light');
  assert.equal(plan.isCompatiblePy313, true);
  assert.equal(plan.astReplacements, 9);
});
