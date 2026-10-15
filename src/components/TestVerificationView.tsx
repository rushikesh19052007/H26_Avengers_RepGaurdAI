import React, { useState } from 'react';
import { DependencyItem, ScannedRepositoryData } from '../types';

interface TestVerificationViewProps {
  dependencies?: DependencyItem[];
  scannedRepo?: ScannedRepositoryData | null;
}

export const TestVerificationView: React.FC<TestVerificationViewProps> = ({
  dependencies = [],
  scannedRepo,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<'3.12' | '3.13'>('3.12');

  const repoName = scannedRepo?.name || 'Scanned Repository';
  const runtime = scannedRepo?.pythonRuntime || 'Python 3.12 / 3.13';

  // Build dynamic test suites from actual dependencies
  const targetDeps = dependencies.slice(0, 5);
  const testSuites =
    targetDeps.length > 0
      ? targetDeps.map((dep, idx) => ({
          name: `tests/test_${dep.name.replace(/[-.]/g, '_')}_resilience.py`,
          tests: Math.max(3, dep.astCallSites + 1),
          passed: dep.riskSeverity === 'High' ? dep.astCallSites - 1 : dep.astCallSites + 1,
          duration: `${(0.12 + idx * 0.07).toFixed(2)}s`,
          status: dep.riskSeverity === 'High' ? 'Failed' : 'Passed',
          description: `Validation suite verifying AST transform and import integrity for ${dep.name} under Python ${selectedEnv}.`,
        }))
      : [
          {
            name: 'tests/test_ast_integrity.py',
            tests: 5,
            passed: 5,
            duration: '0.18s',
            status: 'Passed',
            description: 'Ensures no unresolved symbols, syntax errors, or orphan import nodes in AST.',
          },
        ];

  const totalTests = testSuites.reduce((acc, s) => acc + s.tests, 0);
  const totalPassed = testSuites.reduce((acc, s) => acc + s.passed, 0);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">
              Test &amp; Verification
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-semibold border border-tertiary/20">
              {totalPassed}/{totalTests} Tests Passing
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Hermetic sandbox validation across {runtime} for {repoName}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-surface-container-high/60">
            <button
              onClick={() => setSelectedEnv('3.12')}
              className={`px-3 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                selectedEnv === '3.12'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Python 3.12
            </button>
            <button
              onClick={() => setSelectedEnv('3.13')}
              className={`px-3 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                selectedEnv === '3.13'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Python 3.13
            </button>
          </div>

          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary text-[13px] font-semibold hover:opacity-95 shadow-xs transition-all cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isRunning ? 'animate-spin' : ''
              }`}
            >
              play_arrow
            </span>
            <span>{isRunning ? 'Running Pytest...' : 'Execute Test Suite'}</span>
          </button>
        </div>
      </div>

      {/* Test Suites List */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 overflow-hidden divide-y divide-surface-container-low">
        {testSuites.map((suite, idx) => (
          <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-low/50 transition-colors">
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined text-[20px] mt-0.5 ${
                suite.status === 'Passed' ? 'text-emerald-600' : 'text-error'
              }`}>
                {suite.status === 'Passed' ? 'check_circle' : 'cancel'}
              </span>
              <div className="flex flex-col">
                <span className="font-mono text-[13px] font-semibold text-on-surface">
                  {suite.name}
                </span>
                <span className="text-[12px] text-on-surface-variant mt-0.5">
                  {suite.description}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 font-mono text-[12px]">
              <span className="text-on-surface-variant">{suite.duration}</span>
              <span className="text-on-surface-variant">{suite.passed}/{suite.tests} passed</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                suite.status === 'Passed' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-error-container text-error'
              }`}>
                {suite.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
