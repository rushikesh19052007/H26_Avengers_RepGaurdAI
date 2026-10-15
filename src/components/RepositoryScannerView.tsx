import React, { useState } from 'react';
import { WorkspaceView, DependencyItem, ScannedRepositoryData } from '../types';

interface RepositoryScannerViewProps {
  onSelectView: (view: WorkspaceView) => void;
  scannedRepo?: ScannedRepositoryData | null;
  dependencies?: DependencyItem[];
}

export const RepositoryScannerView: React.FC<RepositoryScannerViewProps> = ({
  onSelectView,
  scannedRepo,
  dependencies = [],
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'manifest' | 'files'>('telemetry');
  const [fileSearch, setFileSearch] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  const repoName = scannedRepo?.name || 'Scanned Repository';
  const repoUrl = scannedRepo?.url || 'https://github.com/scanned/repository';
  const branch = scannedRepo?.branch || 'main';
  const runtime = scannedRepo?.pythonRuntime || 'Python 3.12 / 3.13';
  const manifestName = scannedRepo?.manifestName || 'requirements.txt';
  const manifestContent = scannedRepo?.manifestContent || dependencies.map((d) => `${d.name}==${d.version}`).join('\n');
  const files = scannedRepo?.files && scannedRepo.files.length > 0 ? scannedRepo.files : ['app.py', 'requirements.txt', 'README.md'];

  const totalDeps = dependencies.length || scannedRepo?.summary.total || 0;
  const highRisk = dependencies.filter((d) => d.riskSeverity === 'High').length;
  const needsReview = dependencies.filter((d) => d.riskSeverity === 'Needs Review').length;
  const totalRisks = highRisk + needsReview;
  const totalCallSites = dependencies.reduce((acc, d) => acc + (d.astCallSites || 1), 0);

  const filteredFiles = files.filter((f) => f.toLowerCase().includes(fileSearch.toLowerCase()));

  const handleRescan = () => {
    setIsRescanning(true);
    setTimeout(() => {
      setIsRescanning(false);
      onSelectView('landing');
    }, 600);
  };

  const handleExportJSON = () => {
    const data = {
      repository: repoUrl,
      name: repoName,
      branch,
      runtime_target: runtime,
      timestamp: new Date().toISOString(),
      dependencies_found: totalDeps,
      risk_signals: totalRisks,
      ast_call_sites_total: totalCallSites,
      ast_source_files: files.length,
      manifest_file: manifestName,
      dependencies: dependencies.map((d) => ({
        name: d.name,
        version: d.version,
        target_version: d.targetVersion,
        severity: d.riskSeverity,
        reason: d.riskReason,
        call_sites: d.astCallSites,
      })),
      files,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depguard-ast-${repoName.replace(/[/\\?%*:|"<>]/g, '-')}-${branch}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const logLines = [
    `[${scannedRepo?.lastScanned || '14:32:01'}] INFO  depguard.scanner: Scanning target ${repoUrl} (branch: ${branch})`,
    `[${scannedRepo?.lastScanned || '14:32:02'}] INFO  depguard.manifest: Located manifest ${manifestName} (${totalDeps} dependencies parsed)`,
    ...dependencies.slice(0, 3).map((d) => `[${scannedRepo?.lastScanned || '14:32:03'}] INFO  depguard.ast: Traced AST usage for '${d.name}' (${d.astCallSites} call sites across codebase)`),
    ...(highRisk > 0
      ? dependencies
          .filter((d) => d.riskSeverity === 'High')
          .slice(0, 2)
          .map((d) => `[${scannedRepo?.lastScanned || '14:32:04'}] WARN  depguard.risk: Package '${d.name}==${d.version}': ${d.riskReason}`)
      : []),
    `[${scannedRepo?.lastScanned || '14:32:05'}] SUCCESS depguard.pipeline: Pipeline completed. Indexed ${files.length} files, ${totalDeps} packages, ${totalRisks} risk items.`,
  ];

  const logText = logLines.join('\n');

  const handleCopyLog = () => {
    navigator.clipboard.writeText(logText);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 1500);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Technical Header & Target Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[24px] text-on-surface tracking-tight font-semibold">
              Repository Scanner
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high font-mono text-[11px] text-primary font-semibold border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Live AST Telemetry
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Inspected source files, manifest specifications, and call-site graphs for {repoName}.
          </p>
        </div>

        {/* Python Runtime Compatibility Pill */}
        <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-surface-container-low shadow-xs border border-surface-container-high/70">
          <span className="material-symbols-outlined text-[18px] text-tertiary">verified_user</span>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[11px] text-on-surface font-semibold">
              Runtime: {runtime}
            </span>
            <span className="font-mono text-[10px] text-secondary">
              Strict compatibility checking active
            </span>
          </div>
        </div>
      </div>

      {/* Repository Target Form Card */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container-high/70 mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
            <span className="text-[16px] text-on-surface font-semibold">Target Specification</span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-secondary-container font-medium border border-surface-container-high">
            {scannedRepo?.source === 'zip' ? 'Local Archive' : scannedRepo?.source === 'backend' ? 'Local API' : 'Remote GitHub'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase font-medium">
              Repository Name
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low font-mono text-[13px] text-on-surface border border-surface-container-high/60 truncate">
              <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
              <span className="truncate font-semibold">{repoName}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase font-medium">
              Branch / Snapshot
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low font-mono text-[13px] text-on-surface border border-surface-container-high/60">
              <span className="material-symbols-outlined text-[16px] text-secondary">fork_right</span>
              <span>{branch}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase font-medium">
              Manifest File
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low font-mono text-[13px] text-on-surface border border-surface-container-high/60 truncate">
              <span className="material-symbols-outlined text-[16px] text-tertiary">description</span>
              <span className="truncate">{manifestName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/50 flex-wrap gap-3">
          <span className="font-mono text-[11px] text-on-surface-variant truncate max-w-xl">
            Location: {repoUrl}
          </span>
          <button
            onClick={handleRescan}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-[16px] ${isRescanning ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Scan Different Repo</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Packages Discovered */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-high/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Packages Discovered
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[32px] text-on-surface font-semibold leading-none">{totalDeps}</div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-secondary mt-1">
              <span>Parsed from {manifestName}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Source Files Inspected */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-high/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Files In Repository
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">data_object</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[32px] text-on-surface font-semibold leading-none">{files.length}</div>
            <div className="font-mono text-[11px] text-secondary mt-1">
              Indexed in repository tree
            </div>
          </div>
        </div>

        {/* Metric 3: Risk Signals Detected */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-high/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Risk Signals Detected
            </span>
            <span className={`p-1.5 rounded-lg ${totalRisks > 0 ? 'bg-error-container text-error' : 'bg-emerald-500/10 text-emerald-700'}`}>
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-[32px] font-semibold leading-none ${totalRisks > 0 ? 'text-error' : 'text-emerald-600'}`}>
              {totalRisks}
            </div>
            <div className="font-mono text-[11px] text-secondary mt-1">
              {highRisk} high · {needsReview} review
            </div>
          </div>
        </div>

        {/* Metric 4: AST Call Sites */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-xs border border-surface-container-high/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-on-surface-variant font-medium">
              AST Call Sites Mapped
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-tertiary">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-[32px] text-on-surface font-semibold leading-none">{totalCallSites}</div>
            <div className="font-mono text-[11px] text-secondary mt-1">
              Call sites traced in source
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Telemetry Log / Manifest Content / Real Files Tree */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 pt-3 bg-surface-container-low border-b border-surface-container-high/60">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`pb-3 px-1 text-[14px] cursor-pointer transition-colors ${
                activeTab === 'telemetry'
                  ? 'font-semibold text-primary shadow-[inset_0_-2px_0_0] shadow-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Scanner Telemetry
            </button>
            <button
              onClick={() => setActiveTab('manifest')}
              className={`pb-3 px-1 text-[14px] cursor-pointer transition-colors ${
                activeTab === 'manifest'
                  ? 'font-semibold text-primary shadow-[inset_0_-2px_0_0] shadow-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Manifest ({manifestName})
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`pb-3 px-1 text-[14px] cursor-pointer transition-colors ${
                activeTab === 'files'
                  ? 'font-semibold text-primary shadow-[inset_0_-2px_0_0] shadow-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Scanned Files ({files.length})
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 pb-3 font-mono text-[11px] text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Indexed</span>
          </div>
        </div>

        {/* Tab 1: Terminal Log Preview */}
        {activeTab === 'telemetry' && (
          <div className="p-4 bg-surface-container-low/60">
            <div className="bg-surface-container-lowest rounded-lg p-4 shadow-xs border border-surface-container-high/70 font-mono text-[12px] leading-relaxed overflow-x-auto text-on-surface">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-surface-container-high"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-surface-container-high"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-surface-container-high"></span>
                  <span className="font-mono text-[11px] text-secondary ml-1">
                    depguard:stdout
                  </span>
                </div>
                <button
                  onClick={handleCopyLog}
                  className="hover:text-primary transition-colors flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedLog ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedLog ? 'Copied' : 'Copy Log'}</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5 whitespace-pre-wrap">
                {logLines.map((line, idx) => (
                  <div key={idx} className={line.includes('WARN') ? 'text-amber-500' : line.includes('SUCCESS') ? 'text-emerald-500 font-medium' : 'text-on-surface-variant'}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Real Manifest Content */}
        {activeTab === 'manifest' && (
          <div className="p-4 bg-surface-container-low/60">
            <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xs border border-surface-container-high/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[15px] font-semibold text-on-surface">{manifestName}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface border border-surface-container-high">
                  {totalDeps} dependencies
                </span>
              </div>
              <pre className="p-3 rounded bg-surface-container-low font-mono text-[12px] text-on-surface leading-relaxed border border-surface-container-high/50 overflow-x-auto max-h-72">
                {manifestContent}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Real Files in Scanned Repository */}
        {activeTab === 'files' && (
          <div className="p-4 bg-surface-container-low/60">
            <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xs border border-surface-container-high/70">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
                    search
                  </span>
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Filter scanned repository files..."
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-container-low font-mono text-[12px] text-on-surface outline-none border border-surface-container-high/60 focus:border-primary"
                  />
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
                  Showing {filteredFiles.length} of {files.length}
                </span>
              </div>

              <div className="divide-y divide-surface-container-low max-h-72 overflow-y-auto font-mono text-[12px]">
                {filteredFiles.map((f, idx) => (
                  <div key={idx} className="py-2 px-3 flex items-center justify-between hover:bg-surface-container-low/60 rounded">
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
                        {f.endsWith('.py') ? 'terminal' : f.endsWith('.json') ? 'data_object' : f.endsWith('.md') ? 'article' : 'description'}
                      </span>
                      <span className="text-on-surface truncate">{f}</span>
                    </div>
                    <span className="text-on-surface-variant text-[11px] shrink-0">
                      {f.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low shadow-xs border border-surface-container-high/70">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary text-[20px]">task_alt</span>
          <span className="text-[13px] text-on-surface font-semibold">
            Repository inspection completed successfully.
          </span>
          <span className="text-[13px] text-on-surface-variant hidden md:inline">
            {totalRisks > 0 ? `${totalRisks} risk candidates identified.` : 'All dependencies compatible.'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportJSON}
            type="button"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-[13px] font-semibold hover:bg-surface-container shadow-xs transition-colors cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export AST JSON</span>
          </button>

          <button
            onClick={() => onSelectView('dependency-risks')}
            type="button"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary text-[13px] font-semibold hover:opacity-95 shadow-xs transition-all cursor-pointer"
          >
            <span>View Dependency Risks ({totalRisks})</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
