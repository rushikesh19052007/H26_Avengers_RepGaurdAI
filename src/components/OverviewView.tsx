import React, { useState } from 'react';
import { WorkspaceView, DependencyItem, ScannedRepositoryData } from '../types';

interface OverviewViewProps {
  onSelectView: (view: WorkspaceView) => void;
  onSelectDependency: (dep: DependencyItem) => void;
  dependencies?: DependencyItem[];
  scannedRepo?: ScannedRepositoryData | null;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onSelectView,
  onSelectDependency,
  dependencies = [],
  scannedRepo,
}) => {
  const [filter, setFilter] = useState<'all' | 'high' | 'review'>('all');
  const [isScanning, setIsScanning] = useState(false);

  const repoName = scannedRepo?.name || 'Scanned Repository';
  const repoUrl = scannedRepo?.url || '#';
  const branch = scannedRepo?.branch || 'main';
  const visibility = scannedRepo?.visibility || 'Public';
  const runtime = scannedRepo?.pythonRuntime || 'Python 3.12 / 3.13';
  const lastScan = scannedRepo?.lastScanned || 'Today, just now';

  const totalDeps = dependencies.length;
  const highRiskDeps = dependencies.filter((d) => d.riskSeverity === 'High');
  const reviewDeps = dependencies.filter((d) => d.riskSeverity === 'Needs Review');
  const healthyDeps = dependencies.filter((d) => d.riskSeverity === 'Low');

  const totalCallSites = dependencies.reduce((acc, d) => acc + (d.astCallSites || 1), 0);
  const scannedFilesCount = scannedRepo?.files?.length || dependencies.reduce((acc, d) => acc + (d.astFiles || 1), 0) || 1;

  const healthyPct = totalDeps > 0 ? ((healthyDeps.length / totalDeps) * 100).toFixed(1) : '100.0';
  const reviewPct = totalDeps > 0 ? ((reviewDeps.length / totalDeps) * 100).toFixed(1) : '0.0';
  const highPct = totalDeps > 0 ? ((highRiskDeps.length / totalDeps) * 100).toFixed(1) : '0.0';

  const displayedFindings = dependencies.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'high') return d.riskSeverity === 'High';
    if (filter === 'review') return d.riskSeverity === 'Needs Review';
    return true;
  });

  const criticalDep = highRiskDeps[0] || reviewDeps[0] || null;

  const handleScanRepository = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onSelectView('landing');
    }, 300);
  };

  if (!scannedRepo && dependencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-primary mb-4 shadow-sm border border-surface-container-high">
          <span className="material-symbols-outlined text-[32px]">radar</span>
        </div>
        <h2 className="text-[22px] font-semibold text-on-surface">No Repository Scanned Yet</h2>
        <p className="text-[14px] text-on-surface-variant mt-2 mb-6 leading-relaxed">
          Provide a public GitHub repository URL or upload a ZIP archive to analyze dependencies and run Gemma 4 resilience analysis.
        </p>
        <button
          onClick={() => onSelectView('landing')}
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[14px] font-semibold shadow-md hover:bg-primary-container cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Select Repository to Scan</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Top Real Scan State Banner */}
      <div className="mb-6 rounded-lg bg-surface-container-high px-4 py-2.5 shadow-xs border border-surface-container-highest flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[12px] text-on-surface truncate">
            <strong className="font-semibold text-primary">LIVE SCAN DATA</strong> • Real-time AST dependency analysis for{' '}
            <span className="font-semibold underline decoration-primary/40 underline-offset-2">
              {repoName}
            </span>{' '}
            ({runtime})
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-primary">analytics</span>
          <span>Engine: AST Resilience Analyzer</span>
        </div>
      </div>

      {/* Primary Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] text-on-surface tracking-tight font-semibold">Overview</h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium border border-surface-container-high truncate max-w-xs">
              {repoName}
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Dependency resilience, AST occurrences, and migration readiness for {repoName}.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {repoUrl && repoUrl.startsWith('http') && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-xs hover:bg-surface-container-low transition-all text-[13px] font-medium border border-surface-container-high/80"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                code
              </span>
              <span>View Repository</span>
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant opacity-70">
                open_in_new
              </span>
            </a>
          )}

          <button
            onClick={handleScanRepository}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary shadow-xs hover:opacity-90 active:scale-[0.99] transition-all text-[13px] font-semibold cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isScanning ? 'animate-spin' : ''
              }`}
            >
              {isScanning ? 'refresh' : 'document_scanner'}
            </span>
            <span>{isScanning ? 'Preparing...' : 'New Scan'}</span>
          </button>
        </div>
      </header>

      {/* Repository Metadata Summary Strip */}
      <section className="bg-surface-container-lowest rounded-xl p-4 mb-6 shadow-xs border border-surface-container-high/70">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-center text-left">
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              Repository
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[16px] text-primary">
                folder_open
              </span>
              <span className="text-[13px] font-semibold text-on-surface truncate">
                {repoName}
              </span>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              Source &amp; Visibility
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[13px] text-on-surface">{scannedRepo?.source === 'zip' ? 'Local Archive' : scannedRepo?.source === 'backend' ? 'Local Checkout' : 'GitHub'}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant border border-surface-container-high">
                {visibility}
              </span>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              Default Branch
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[12px] text-on-surface">
              <span className="material-symbols-outlined text-[15px] text-on-surface-variant">
                fork_right
              </span>
              <span className="font-semibold text-primary">{branch}</span>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              Last Scan
            </span>
            <span className="text-[13px] text-on-surface mt-0.5 font-medium truncate">
              {lastScan}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              AST Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[13px] text-on-surface font-medium truncate">
                {totalCallSites} Call Sites Mapped
              </span>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] uppercase text-on-surface-variant font-medium">
              Target Runtime
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-semibold">
                {runtime}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Compact Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Dependencies */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-xs border border-surface-container-high/70 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Dependencies Scanned
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[32px] text-on-surface font-semibold tracking-tight leading-none">
                {totalDeps}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">packages</span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-1.5 line-clamp-2">
              Parsed from{' '}
              <code className="font-mono text-[12px] bg-surface-container px-1 py-0.5 rounded">
                {scannedRepo?.manifestName || 'requirements.txt'}
              </code>
            </p>
          </div>
        </div>

        {/* Card 2: Risk Signals */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-xs border border-surface-container-high/70 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Potential Risk Signals
            </span>
            <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
              highRiskDeps.length > 0 ? 'bg-error-container text-error' : 'bg-emerald-500/10 text-emerald-700'
            }`}>
              {highRiskDeps.length > 0 ? 'Action Req.' : 'Clean'}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-[32px] font-semibold tracking-tight leading-none ${
                highRiskDeps.length > 0 ? 'text-error' : 'text-emerald-600'
              }`}>
                {highRiskDeps.length + reviewDeps.length}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">flagged</span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-1.5 line-clamp-2">
              {highRiskDeps.length} high severity, {reviewDeps.length} needing review
            </p>
          </div>
        </div>

        {/* Card 3: Healthy / Verified */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-xs border border-surface-container-high/70 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Verified Compatible
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-tertiary-fixed text-tertiary font-semibold">
              Passing
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[32px] text-tertiary font-semibold tracking-tight leading-none">
                {healthyDeps.length}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">of {totalDeps}</span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-1.5 line-clamp-2">
              Confirmed compatible with {runtime}
            </p>
          </div>
        </div>

        {/* Card 4: AST Nodes Traced */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-xs border border-surface-container-high/70 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              AST Call Sites
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-primary-fixed text-primary font-semibold">
              Indexed
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[32px] text-primary font-semibold tracking-tight leading-none">
                {totalCallSites}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">sites</span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-1.5 line-clamp-2">
              Traced across {scannedFilesCount} source files
            </p>
          </div>
        </div>
      </section>

      {/* Critical Attention Banner (if any risk) */}
      {criticalDep && criticalDep.riskSeverity === 'High' && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[22px] mt-0.5">
              warning
            </span>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-on-surface">
                Critical Attention Required: {criticalDep.name}=={criticalDep.version}
              </span>
              <span className="text-[13px] text-on-surface-variant mt-0.5">
                {criticalDep.riskReason} Target modernization: <strong className="text-primary">{criticalDep.targetVersion || criticalDep.migrationRecommendation.targetPackages[0]}</strong>.
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              onSelectDependency(criticalDep);
              onSelectView('ai-migration-assistant');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-[13px] font-semibold shrink-0 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Review Migration Recipe
          </button>
        </div>
      )}

      {/* Dependency Health Visualization */}
      <section className="bg-surface-container-lowest rounded-xl p-5 mb-6 shadow-xs border border-surface-container-high/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] text-on-surface font-semibold tracking-tight">
              Dependency Health Breakdown
            </h2>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-surface-container-high">
              {totalDeps} Packages Evaluated
            </span>
          </div>
          <span className="font-mono text-[11px] text-on-surface-variant">
            Target Stack: {runtime} Matrix
          </span>
        </div>

        {/* Segmented Health Bar */}
        <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-surface-container-low mb-4 border border-surface-container-high/40">
          <div
            className="bg-[#15803D] transition-all duration-500 hover:opacity-90"
            style={{ width: `${healthyPct}%` }}
            title={`${healthyDeps.length} Healthy (${healthyPct}%)`}
          ></div>
          <div
            className="bg-[#B45309] transition-all duration-500 hover:opacity-90"
            style={{ width: `${reviewPct}%` }}
            title={`${reviewDeps.length} Needs Review (${reviewPct}%)`}
          ></div>
          <div
            className="bg-[#B91C1C] transition-all duration-500 hover:opacity-90"
            style={{ width: `${highPct}%` }}
            title={`${highRiskDeps.length} High Risk (${highPct}%)`}
          ></div>
        </div>

        {/* Health Legend & Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="flex items-start gap-2.5">
            <div className="w-3 h-3 rounded-xs bg-[#15803D] mt-1 flex-shrink-0"></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[16px] text-on-surface font-semibold">{healthyDeps.length}</span>
                <span className="text-[13px] text-on-surface-variant">({healthyPct}%)</span>
                <span className="font-mono text-[11px] font-medium text-[#15803D]">Healthy</span>
              </div>
              <span className="text-[12px] text-on-surface-variant mt-0.5">
                Active upstream support with confirmed {runtime} wheel compatibility.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-3 h-3 rounded-xs bg-[#B45309] mt-1 flex-shrink-0"></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[16px] text-on-surface font-semibold">{reviewDeps.length}</span>
                <span className="text-[13px] text-on-surface-variant">({reviewPct}%)</span>
                <span className="font-mono text-[11px] font-medium text-[#B45309]">Needs Review</span>
              </div>
              <span className="text-[12px] text-on-surface-variant mt-0.5">
                Minor deprecation warnings or older major versions detected.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-3 h-3 rounded-xs bg-[#B91C1C] mt-1 flex-shrink-0"></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[16px] text-on-surface font-semibold">{highRiskDeps.length}</span>
                <span className="text-[13px] text-on-surface-variant">({highPct}%)</span>
                <span className="font-mono text-[11px] font-medium text-[#B91C1C]">High Risk</span>
              </div>
              <span className="text-[12px] text-on-surface-variant mt-0.5">
                Incompatible with runtime or deprecated legacy dependencies.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Two Column Split: Recent Findings (2/3) + Activity Timeline (1/3) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Recent Findings */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 flex flex-col overflow-hidden">
          {/* Card Header with Filter Pills */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high/50">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] text-on-surface font-semibold">Scanned Dependency Findings</h3>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-surface-container-high">
                {displayedFindings.length} packages
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-surface-container-high/40">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({totalDeps})
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                  filter === 'high'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                High Risk ({highRiskDeps.length})
              </button>
              <button
                onClick={() => setFilter('review')}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                  filter === 'review'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Needs Review ({reviewDeps.length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface-container-low text-on-surface-variant font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Dependency</th>
                  <th className="py-2.5 px-3 font-medium">Version</th>
                  <th className="py-2.5 px-3 font-medium">Risk Level</th>
                  <th className="py-2.5 px-3 font-medium">AST Occurrences</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low bg-surface-container-lowest">
                {displayedFindings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-on-surface-variant font-mono text-[13px]">
                      No dependencies match the current filter.
                    </td>
                  </tr>
                ) : (
                  displayedFindings.map((dep) => (
                    <tr
                      key={dep.id}
                      onClick={() => {
                        onSelectDependency(dep);
                        onSelectView('dependency-risks');
                      }}
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-semibold text-on-surface">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-primary">
                            package_2
                          </span>
                          <span className="group-hover:text-primary transition-colors">{dep.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[12px] text-on-surface-variant">
                        {dep.version}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            dep.riskSeverity === 'High'
                              ? 'bg-error-container text-error'
                              : dep.riskSeverity === 'Needs Review'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-emerald-500/10 text-emerald-700'
                          }`}
                        >
                          {dep.riskSeverity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[12px] text-on-surface-variant">
                        {dep.astCallSites} call sites
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                            dep.status === 'Verified'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : dep.status === 'Failed'
                              ? 'bg-error-container text-error'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDependency(dep);
                            onSelectView('ai-migration-assistant');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-on-primary text-[12px] font-semibold hover:opacity-90 shadow-xs transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                          <span>Recipe</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Micro Footer */}
          <div className="px-4 py-2.5 bg-surface-container-low/50 border-t border-surface-container-high/50 flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
            <span>Showing {displayedFindings.length} of {totalDeps} scanned packages</span>
            <button
              onClick={() => onSelectView('dependency-risks')}
              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
            >
              <span>View full graph in Dependency Risks</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Right Panel: Audit Stream Timeline */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-4 shadow-xs border border-surface-container-high/70 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-high/50">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">sensors</span>
              <h3 className="text-[15px] text-on-surface font-semibold">Audit Stream</h3>
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant">Live Session</span>
          </div>

          {/* Timeline Items from Real Scan */}
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-surface-container-high"></div>

            {(scannedRepo?.activityLogs && scannedRepo.activityLogs.length > 0
              ? scannedRepo.activityLogs
              : [
                  {
                    id: 'act-1',
                    timestamp: lastScan,
                    type: 'scan' as const,
                    title: `Repository Scan Completed`,
                    description: `Loaded ${totalDeps} dependencies across ${scannedFilesCount} source files.`,
                  },
                  {
                    id: 'act-2',
                    timestamp: lastScan,
                    type: 'manifest' as const,
                    title: `AST Resilience Analysis`,
                    description: `Synthesized migration plans for ${highRiskDeps.length + reviewDeps.length} packages.`,
                  },
                ]
            ).map((log) => (
              <div key={log.id} className="relative flex flex-col gap-0.5">
                <span className="absolute -left-6 top-1 flex h-3 w-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-on-surface">
                    {log.title}
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant">{log.timestamp}</span>
                </div>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  {log.description}
                </p>
              </div>
            ))}
          </div>

          {/* Micro telemetry card */}
          <div className="mt-5 p-3 rounded-lg bg-surface-container-low flex flex-col gap-1 border border-surface-container-high/60">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant font-semibold">
                Telemetry Status
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Target repository: {repoName} ({totalDeps} dependencies, {totalCallSites} AST occurrences).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
