import React, { useState, useEffect, useRef } from 'react';
import { WorkspaceView, ScannedRepositoryData } from '../types';
import { DepGuardLogo } from './DepGuardLogo';
import {
  initiateScan,
  pollScanStatus,
  fetchScanResults,
  mapBackendResultsToRepositoryData,
} from '../services/api';
import { ScanStageItem } from '../types/api';

interface ScanningProgressViewProps {
  onCompleteScan: () => void;
  onCancelScan: () => void;
  onSelectView: (view: WorkspaceView) => void;
  repoUrl?: string;
  scanFile?: File | null;
  onScanResult?: (result: ScannedRepositoryData) => void;
}

export const ScanningProgressView: React.FC<ScanningProgressViewProps> = ({
  onCompleteScan,
  onCancelScan,
  onSelectView,
  repoUrl,
  scanFile,
  onScanResult,
}) => {
  const [progress, setProgress] = useState(5);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedRepositoryData | null>(null);
  const [backendStages, setBackendStages] = useState<ScanStageItem[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const targetDisplayName = repoUrl
    ? repoUrl.replace(/^https?:\/\/github\.com\//i, '')
    : scanFile
    ? scanFile.name
    : 'Selected Repository';

  const onScanResultRef = useRef(onScanResult);
  onScanResultRef.current = onScanResult;

  const [logs, setLogs] = useState<Array<{ time: string; type: string; text: string }>>([
    { time: new Date().toLocaleTimeString(), type: 'system', text: `INIT: Connecting to backend pipeline for ${targetDisplayName}` },
  ]);

  useEffect(() => {
    let isSubscribed = true;
    let pollInterval: NodeJS.Timeout | null = null;

    async function runScanWorkflow() {
      try {
        setErrorMsg(null);
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            type: 'system',
            text: `POST /api/scans: Initiating safe scan pipeline...`,
          },
        ]);

        const initRes = await initiateScan({ repoUrl, file: scanFile });
        if (!isSubscribed) return;

        const scanId = initRes.scan_id;
        setBackendStages(initRes.stages || []);
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            type: 'info',
            text: `SESSION: Scan registered [${scanId}]. Monitoring execution stages...`,
          },
        ]);

        // Poll every 800ms
        pollInterval = setInterval(async () => {
          if (!isSubscribed) return;

          try {
            const statusRes = await pollScanStatus(scanId);
            if (!isSubscribed) return;

            setProgress(statusRes.progress_percent || 10);
            if (statusRes.stages) {
              setBackendStages(statusRes.stages);
            }

            // Log stage updates
            if (statusRes.current_stage) {
              setLogs((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.text.includes(statusRes.current_stage)) return prev;
                return [
                  ...prev,
                  {
                    time: new Date().toLocaleTimeString(),
                    type: statusRes.current_stage.includes('Gemma') ? 'gemma' : 'info',
                    text: `STAGE: ${statusRes.current_stage}`,
                  },
                ];
              });
            }

            if (statusRes.status === 'completed') {
              if (pollInterval) clearInterval(pollInterval);
              setProgress(100);

              const resultsRes = await fetchScanResults(scanId);
              if (!isSubscribed) return;

              const mappedData = mapBackendResultsToRepositoryData(resultsRes);
              setScannedData(mappedData);
              setIsDone(true);

              setLogs((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  type: 'success',
                  text: `COMPLETED: ${mappedData.summary.total} packages evaluated. ${mappedData.summary.highRisk} high risk, ${mappedData.summary.needsReview} review required.`,
                },
                {
                  time: new Date().toLocaleTimeString(),
                  type: 'done',
                  text: `EXIT CAPSULE: Generated JSON and Markdown audit capsules.`,
                },
              ]);

              onScanResultRef.current?.(mappedData);
            } else if (statusRes.status === 'failed') {
              if (pollInterval) clearInterval(pollInterval);
              const err = statusRes.error || 'Scan pipeline failed on backend.';
              setErrorMsg(err);
              setLogs((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  type: 'warn',
                  text: `FAILED: ${err}`,
                },
              ]);
            }
          } catch (pollErr: unknown) {
            const msg = pollErr instanceof Error ? pollErr.message : 'Status polling error';
            console.warn('[DepGuard AI] Polling notice:', msg);
          }
        }, 800);
      } catch (err: unknown) {
        if (!isSubscribed) return;
        const msg = err instanceof Error ? err.message : 'Failed to launch repository scan';
        setErrorMsg(msg);
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            type: 'warn',
            text: `ERROR: ${msg}`,
          },
        ]);
      }
    }

    runScanWorkflow();

    return () => {
      isSubscribed = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [repoUrl, scanFile]);

  // Scroll console logs to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans selection:bg-primary/10 selection:text-primary">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-b border-surface-container-high/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DepGuardLogo size={32} />
            <div className="flex flex-col">
              <span className="font-bold text-[16px] tracking-tight text-on-surface">
                DepGuard AI
              </span>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Live Scanner
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-2" aria-label="Scanning progress navigation">
              <button
                onClick={() => onSelectView('landing')}
                className="px-3 py-1 text-[13px] text-on-surface-variant hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              >
                Back to Home
              </button>
            </nav>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
                <span className="material-symbols-outlined text-[18px]">radar</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 flex-1 max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center py-6">
        <div className="flex flex-col w-full py-4">
          {/* Top Context Header Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <div className="flex flex-col gap-1 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface border border-surface-container-high/60">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                    folder_open
                  </span>
                  <span className="font-mono text-[11px] font-medium truncate max-w-xs">{targetDisplayName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                  <span className="material-symbols-outlined text-[13px]">terminal</span>
                  <span className="font-mono text-[11px]">Python 3.12 / 3.13</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary border border-primary/20">
                  <span className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-500' : errorMsg ? 'bg-error' : 'bg-primary animate-ping'}`}></span>
                  <span className="font-mono text-[11px] font-semibold">
                    {isDone ? 'Scan Completed · 100%' : errorMsg ? 'Scan Failed' : `Analysis in progress · ${progress}%`}
                  </span>
                </div>
              </div>
              <h1 className="text-[28px] md:text-[32px] text-on-surface font-semibold tracking-tight">
                Scanning {targetDisplayName}
              </h1>
              <p className="text-[14px] text-on-surface-variant">
                Parsing manifests, mapping AST invocation graphs, and running Gemma 4 dependency resilience analysis.
              </p>
            </div>

            {/* Right Summary Metrics Strip */}
            <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-xl border border-surface-container-high/60">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase font-medium">
                  Scanned Nodes
                </span>
                <span className="text-[16px] text-on-surface font-semibold">
                  {scannedData ? `${scannedData.summary.astCallSites} AST Sites` : 'Tracing...'}
                </span>
              </div>
              <div className="w-px h-8 bg-surface-container-high"></div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase font-medium">
                  Identified Risks
                </span>
                <span className={`text-[16px] font-semibold ${scannedData && scannedData.summary.highRisk > 0 ? 'text-error' : 'text-emerald-600'}`}>
                  {scannedData ? `${scannedData.summary.highRisk} High` : 'Analyzing...'}
                </span>
              </div>
              <div className="w-px h-8 bg-surface-container-high"></div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase font-medium">
                  Packages
                </span>
                <span className="text-[16px] text-primary font-semibold">
                  {scannedData ? `${scannedData.dependencies.length} Found` : 'Parsing...'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-container-low rounded-full h-2 mb-8 overflow-hidden border border-surface-container-high/40">
            <div
              className={`h-full transition-all duration-300 rounded-full ${errorMsg ? 'bg-error' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Error Banner if scan failed */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-[22px] shrink-0">error</span>
                <div>
                  <h4 className="text-[14px] font-semibold text-error">Scan Pipeline Encountered an Error</h4>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">{errorMsg}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onCancelScan}
                  className="px-4 py-1.5 rounded-lg bg-surface-container text-on-surface text-[12px] font-medium border border-surface-container-high hover:bg-surface-container-high"
                >
                  Back to Repo Selection
                </button>
              </div>
            </div>
          )}

          {/* Two Columns Grid: Left Stages / Right Terminal Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Real Stages (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <section className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container-high/70">
                <h3 className="text-[16px] text-on-surface font-semibold mb-4">
                  Scanner Execution Sequence
                </h3>

                <div className="space-y-2.5">
                  {(backendStages.length > 0 ? backendStages : [
                    { id: 'validate', name: 'Validating repository', status: 'completed' as const },
                    { id: 'retrieve', name: 'Retrieving repository files', status: 'in_progress' as const },
                    { id: 'parse', name: 'Parsing dependency manifests', status: 'pending' as const },
                    { id: 'map_ast', name: 'Mapping source usages', status: 'pending' as const },
                    { id: 'metadata', name: 'Collecting available metadata', status: 'pending' as const },
                    { id: 'gemma_ai', name: 'Running Gemma 4 analysis', status: 'pending' as const },
                    { id: 'validate_ai', name: 'Validating model output', status: 'pending' as const },
                    { id: 'verify', name: 'Running available verification checks', status: 'pending' as const },
                    { id: 'capsule', name: 'Generating the Exit Capsule', status: 'pending' as const },
                  ]).map((stage) => {
                    const isStageCompleted = stage.status === 'completed';
                    const isStageActive = stage.status === 'in_progress';
                    const isStageFailed = stage.status === 'failed';

                    return (
                      <div
                        key={stage.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                          isStageActive
                            ? 'bg-surface-container-low border-primary/40 shadow-xs'
                            : isStageCompleted
                            ? 'bg-surface border-surface-container-high/40'
                            : isStageFailed
                            ? 'bg-error/5 border-error/30'
                            : 'bg-surface/50 border-surface-container-high/20 opacity-60'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isStageCompleted
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : isStageActive
                              ? 'bg-primary text-on-primary'
                              : isStageFailed
                              ? 'bg-error/10 text-error'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {isStageCompleted ? (
                            <span className="material-symbols-outlined text-[15px]">check</span>
                          ) : isStageActive ? (
                            <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                          ) : isStageFailed ? (
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          ) : (
                            <span className="material-symbols-outlined text-[13px]">radio_button_unchecked</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col">
                          <span className="text-[13px] font-semibold text-on-surface">{stage.name}</span>
                          {stage.details && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">{stage.details}</p>
                          )}
                        </div>
                        <span
                          className={`font-mono text-[11px] font-medium ${
                            isStageCompleted
                              ? 'text-emerald-700'
                              : isStageActive
                              ? 'text-primary'
                              : isStageFailed
                              ? 'text-error'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {isStageCompleted ? 'Done' : isStageActive ? 'Running' : isStageFailed ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={onCancelScan}
                  type="button"
                  className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface text-[13px] font-medium cursor-pointer border border-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  onClick={onCompleteScan}
                  type="button"
                  disabled={!isDone}
                  className={`px-5 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition-all ${
                    isDone
                      ? 'bg-primary text-on-primary hover:opacity-95'
                      : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>{isDone ? 'Open Dashboard' : 'Scanning...'}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Right Column: Console Stream Feed (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-surface-container-high/70 flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-high/60">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
                    <span className="text-[14px] font-semibold text-on-surface">Live Scanner Output</span>
                  </div>
                  <span className="font-mono text-[11px] text-on-surface-variant">STREAMING</span>
                </div>

                <div
                  ref={terminalRef}
                  className="font-mono text-[12px] flex flex-col space-y-1.5 overflow-y-auto max-h-[360px] pr-1 leading-relaxed"
                >
                  {logs
                    .filter((item): item is NonNullable<typeof item> => Boolean(item && typeof item === 'object' && item.time))
                    .map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-on-surface-variant text-[11px] opacity-70">[{item.time}]</span>
                        {item.type === 'warn' ? (
                          <span className="text-amber-500">{item.text}</span>
                        ) : item.type === 'gemma' ? (
                          <span className="text-primary font-semibold">{item.text}</span>
                        ) : item.type === 'done' || item.type === 'success' ? (
                          <span className="text-emerald-500 font-semibold">{item.text}</span>
                        ) : (
                          <span className="text-on-surface">{item.text}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
