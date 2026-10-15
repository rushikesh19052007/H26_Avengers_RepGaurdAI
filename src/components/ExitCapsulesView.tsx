import React, { useState } from 'react';
import { DependencyItem, ScannedRepositoryData } from '../types';
import { getCapsuleDownloadUrl, fetchCapsuleContent } from '../services/api';

interface ExitCapsulesViewProps {
  dependencies?: DependencyItem[];
  scannedRepo?: ScannedRepositoryData | null;
}

export const ExitCapsulesView: React.FC<ExitCapsulesViewProps> = ({
  dependencies = [],
  scannedRepo,
}) => {
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingMd, setDownloadingMd] = useState(false);

  const repoName = scannedRepo?.name || 'Scanned Repository';
  const runtime = scannedRepo?.pythonRuntime || 'Python 3.12 / 3.13';
  const scanId = scannedRepo?.id;

  const flaggedDeps = dependencies.filter((d) => d.riskSeverity === 'High' || d.riskSeverity === 'Needs Review');
  const targetDeps = flaggedDeps.length > 0 ? flaggedDeps : dependencies;

  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    try {
      if (scanId && scanId.startsWith('scan-')) {
        const content = await fetchCapsuleContent(scanId, 'json');
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depguard_capsule_${repoName.replace(/[^\w.-]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Client-side fallback compilation
        const capsule = {
          capsule_schema_version: '1.0.0',
          repository: { name: repoName, url: scannedRepo?.url, branch: scannedRepo?.branch },
          summary: scannedRepo?.summary,
          dependencies: dependencies.map((d) => ({
            name: d.name,
            version: d.version,
            risk_severity: d.riskSeverity,
            evidence: d.evidenceSource,
            call_sites: d.astCallSites,
            migration: d.migrationRecommendation,
          })),
        };
        const blob = new Blob([JSON.stringify(capsule, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depguard_capsule_${repoName.replace(/[^\w.-]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setDownloadingMd(true);
    try {
      if (scanId && scanId.startsWith('scan-')) {
        const content = await fetchCapsuleContent(scanId, 'markdown');
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depguard_capsule_${repoName.replace(/[^\w.-]/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const md = `# Dependency Exit Capsule: ${repoName}\nTarget Runtime: ${runtime}\n\n## Dependencies\n` +
          dependencies.map((d) => `- **${d.name}** (v${d.version}) - ${d.riskSeverity}: ${d.riskReason}`).join('\n');
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depguard_capsule_${repoName.replace(/[^\w.-]/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloadingMd(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">
              Dependency Exit Capsules
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold border border-surface-container-high">
              {dependencies.length} Packages Analyzed
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Exportable dependency resilience certificates, AST migration diffs, and verification reports for {repoName}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadMarkdown}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-container text-on-surface text-[13px] font-semibold border border-surface-container-high hover:bg-surface-container-high shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {downloadingMd ? 'hourglass_top' : 'description'}
            </span>
            <span>{downloadingMd ? 'Exporting...' : 'Export Markdown (.md)'}</span>
          </button>
          <button
            onClick={handleDownloadJson}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-[13px] font-semibold hover:opacity-95 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {downloadingJson ? 'hourglass_top' : 'download'}
            </span>
            <span>{downloadingJson ? 'Exporting...' : 'Export Capsule (.json)'}</span>
          </button>
        </div>
      </div>

      {/* Capsule Content Card */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container-high/70 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            </div>
            <div>
              <span className="text-[16px] font-semibold text-on-surface block">
                {repoName} Dependency Resilience Capsule
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Scan ID: {scanId || 'local-session'} · Target: {runtime}
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-semibold border border-emerald-500/20">
            Certified AST
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase font-medium block mb-1">
              Evaluated Packages
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {dependencies.slice(0, 8).map((d) => (
                <span
                  key={d.id}
                  className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                    d.riskSeverity === 'High'
                      ? 'bg-error/10 text-error border-error/20'
                      : d.riskSeverity === 'Needs Review'
                      ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                      : 'bg-surface text-on-surface border-surface-container-high'
                  }`}
                >
                  {d.name} {d.version}
                </span>
              ))}
              {dependencies.length > 8 && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface text-on-surface-variant border border-surface-container-high">
                  +{dependencies.length - 8} more
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high/60">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase font-medium block mb-1">
              Exit &amp; Upgrade Targets
            </span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {targetDeps.slice(0, 8).map((d) => (
                <span
                  key={d.id}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                >
                  {d.migrationRecommendation?.targetPackages?.[0] || d.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Code Preview of Capsule JSON */}
        <div className="rounded-lg bg-surface-container-highest p-4 font-mono text-[12px] text-on-surface overflow-x-auto max-h-[280px]">
          <pre>{JSON.stringify({
            capsule_schema_version: '1.0.0',
            generator: 'DepGuard AI - Dependency Resilience Engine',
            repository: {
              name: repoName,
              url: scannedRepo?.url,
              branch: scannedRepo?.branch,
              commit_sha: 'HEAD',
            },
            summary: scannedRepo?.summary,
            dependencies: dependencies.map((d) => ({
              package: d.name,
              current_version: d.version,
              severity: d.riskSeverity,
              call_sites: d.astCallSites,
              migration_recipe: d.migrationRecommendation?.title,
            })),
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};
