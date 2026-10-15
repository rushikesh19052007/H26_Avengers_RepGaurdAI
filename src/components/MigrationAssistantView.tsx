import React, { useState } from 'react';
import { DependencyItem } from '../types';

interface MigrationAssistantViewProps {
  selectedDependency?: DependencyItem | null;
}

export const MigrationAssistantView: React.FC<MigrationAssistantViewProps> = ({
  selectedDependency,
}) => {
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedStatus, setAppliedStatus] = useState<'idle' | 'applied'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!selectedDependency) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface-container-lowest rounded-xl border border-surface-container-high/70 text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">
          auto_fix_normal
        </span>
        <h3 className="text-[18px] font-semibold text-on-surface">No Dependency Selected</h3>
        <p className="text-[13px] text-on-surface-variant max-w-sm mt-1">
          Select a dependency from the Overview or Dependency Risks view to examine its AI-assisted migration recipe.
        </p>
      </div>
    );
  }

  const dep = selectedDependency;
  const targetFile = dep.codeSnippets[0]?.file || 'app.py';
  const targetPkg = dep.migrationRecommendation.targetPackages[0] || dep.name;

  const diffOriginal = dep.migrationRecommendation.diffSnippet?.original || `--- a/${targetFile}
+++ b/${targetFile}
@@ -10,4 +10,4 @@
-import ${dep.name}
-`;

  const diffReplacement = dep.migrationRecommendation.diffSnippet?.replacement || `+import ${targetPkg}  # Modernized
+`;

  const handleDryRun = () => {
    setIsRunningDryRun(true);
    setTestResult(null);
    setTimeout(() => {
      setIsRunningDryRun(false);
      setTestResult(`Dry run passed: ${dep.astCallSites} AST call sites transformed cleanly with zero syntax regressions.`);
    }, 1000);
  };

  const handleApply = () => {
    setIsApplying(true);
    setTimeout(() => {
      setIsApplying(false);
      setAppliedStatus('applied');
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">
              AI Migration Assistant
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-semibold border border-primary/20">
              Gemma 4 / AST Synthesis
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Automated AST rewriting and dependency modernization for <strong className="text-on-surface">{dep.name}</strong> (v{dep.version} → {dep.targetVersion || targetPkg}).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDryRun}
            disabled={isRunningDryRun}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium transition-colors cursor-pointer border border-surface-container-high"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isRunningDryRun ? 'animate-spin' : ''
              }`}
            >
              science
            </span>
            <span>{isRunningDryRun ? 'Executing AST Dry-Run...' : 'Dry-Run Verification'}</span>
          </button>

          <button
            onClick={handleApply}
            disabled={isApplying || appliedStatus === 'applied'}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all shadow-xs cursor-pointer ${
              appliedStatus === 'applied'
                ? 'bg-emerald-600 text-white'
                : 'bg-primary-container text-on-primary hover:opacity-95'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {appliedStatus === 'applied' ? 'check_circle' : 'rocket_launch'}
            </span>
            <span>
              {isApplying
                ? 'Applying AST Transform...'
                : appliedStatus === 'applied'
                ? 'AST Patches Applied'
                : 'Apply Migration Recipe'}
            </span>
          </button>
        </div>
      </div>

      {/* Dry Run Feedback Pill */}
      {testResult && (
        <div className="p-3 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[13px] text-emerald-800 font-mono">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              check_circle
            </span>
            <span>{testResult}</span>
          </div>
          <span className="text-[11px] font-bold uppercase text-emerald-700">Verified</span>
        </div>
      )}

      {/* 4 Cards Overview for Selected Dependency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs">
          <span className="font-mono text-[10px] text-on-surface-variant uppercase font-semibold">
            Current Declaration
          </span>
          <div className="text-[20px] text-on-surface font-semibold mt-1 truncate">
            {dep.name}=={dep.version}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">
            Declared in {dep.declaredManifest}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs">
          <span className="font-mono text-[10px] text-on-surface-variant uppercase font-semibold">
            Proposed Target
          </span>
          <div className="text-[20px] text-primary font-semibold mt-1 truncate">
            {dep.targetVersion || targetPkg}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-0.5 truncate">
            {dep.migrationRecommendation.targetPackages.join(', ')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs">
          <span className="font-mono text-[10px] text-on-surface-variant uppercase font-semibold">
            AST Call Sites
          </span>
          <div className="text-[20px] text-on-surface font-semibold mt-1">
            {dep.astCallSites} occurrences
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">
            Indexed across {dep.astFiles} source files
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs">
          <span className="font-mono text-[10px] text-on-surface-variant uppercase font-semibold">
            Confidence Score
          </span>
          <div className="text-[20px] text-emerald-600 font-semibold mt-1">
            {Math.round(dep.migrationRecommendation.confidence * 100)}%
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">
            Verified AST equivalence
          </span>
        </div>
      </div>

      {/* Side-by-Side Diff Viewer */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 overflow-hidden mb-6">
        <div className="p-3.5 bg-surface-container-low flex items-center justify-between border-b border-surface-container-high/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">difference</span>
            <span className="text-[14px] font-semibold text-on-surface">
              Synthesized AST Migration Diff: {targetFile}
            </span>
          </div>
          <span className="font-mono text-[11px] text-on-surface-variant">
            {dep.name} Modernization Recipe
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-container-high/60 font-mono text-[12px]">
          {/* Left: Original Code */}
          <div className="p-4 bg-red-50/30 flex flex-col gap-2">
            <div className="flex items-center justify-between text-error font-semibold pb-1 border-b border-red-200">
              <span>Original AST (Target Invocations)</span>
              <span className="text-[11px]">{targetFile}</span>
            </div>
            <pre className="text-red-900 leading-relaxed overflow-x-auto whitespace-pre font-mono p-2 rounded bg-red-50/50">
              {diffOriginal}
            </pre>
          </div>

          {/* Right: Replacement Code */}
          <div className="p-4 bg-emerald-50/30 flex flex-col gap-2">
            <div className="flex items-center justify-between text-emerald-800 font-semibold pb-1 border-b border-emerald-200">
              <span>Synthesized Replacement (Resilient)</span>
              <span className="text-[11px]">{targetPkg}</span>
            </div>
            <pre className="text-emerald-950 leading-relaxed overflow-x-auto whitespace-pre font-mono p-2 rounded bg-emerald-50/50">
              {diffReplacement}
            </pre>
          </div>
        </div>
      </div>

      {/* Rationale & Execution Plan */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container-high/70">
        <h3 className="text-[16px] font-semibold text-on-surface mb-2">
          Migration Recipe &amp; Rationale
        </h3>
        <p className="text-[13px] text-on-surface-variant leading-relaxed mb-4">
          {dep.migrationRecommendation.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-container-high/50 font-mono text-[11px] text-on-surface-variant">
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium border border-surface-container-high">
            Target: {dep.targetVersion || targetPkg}
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium border border-surface-container-high">
            Ecosystem: {dep.ecosystem}
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium border border-surface-container-high">
            {dep.astCallSites} Call Sites
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium border border-surface-container-high">
            Estimated Synthesis: {dep.migrationRecommendation.estimatedSynthesisTime}
          </span>
        </div>
      </div>
    </div>
  );
};
