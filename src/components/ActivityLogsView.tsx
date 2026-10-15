import React, { useState } from 'react';
import { ActivityLogItem, ScannedRepositoryData, DependencyItem } from '../types';

interface ActivityLogsViewProps {
  scannedRepo?: ScannedRepositoryData | null;
  dependencies?: DependencyItem[];
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({
  scannedRepo,
  dependencies = [],
}) => {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  const repoName = scannedRepo?.name || 'Scanned Repository';

  // Build live activity logs
  const logs: ActivityLogItem[] =
    scannedRepo?.activityLogs && scannedRepo.activityLogs.length > 0
      ? scannedRepo.activityLogs
      : [
          {
            id: 'act-init',
            timestamp: scannedRepo?.lastScanned || '14:32:00',
            type: 'scan' as const,
            title: `Session Initialized for ${repoName}`,
            description: `Ready to trace AST dependencies across ${dependencies.length} packages.`,
            badge: 'Session Active',
            badgeColor: 'bg-emerald-500/10 text-emerald-700',
          },
        ];

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (
      search &&
      !log.title.toLowerCase().includes(search.toLowerCase()) &&
      !log.description.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">Activity Logs</h1>
          <p className="text-[14px] text-on-surface-variant">
            Live audit trail of dependency scans, AST inspections, and migration synthesis for {repoName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = logs.map(
                (l) => `[${l.timestamp}] ${l.title}: ${l.description}`
              ).join('\n');
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `depguard-activity-${repoName.replace(/[/\\?%*:|"<>]/g, '-')}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium transition-colors cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Text Log</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 w-full sm:w-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity events..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-container-low font-mono text-[12px] text-on-surface outline-none border border-surface-container-high/60 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-surface-container-high/40">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilterType('scan')}
            className={`px-3 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
              filterType === 'scan'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Scans
          </button>
          <button
            onClick={() => setFilterType('manifest')}
            className={`px-3 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
              filterType === 'manifest'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Manifest
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 overflow-hidden divide-y divide-surface-container-low">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant font-mono text-[13px]">
            No activity events recorded yet. Run a scan to see audit events.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-low/40 transition-colors">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
                  {log.type === 'scan' ? 'radar' : log.type === 'manifest' ? 'description' : 'history'}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-on-surface">{log.title}</span>
                    {log.badge && (
                      <span className={`px-2 py-0.2 rounded font-mono text-[10px] font-semibold ${log.badgeColor || 'bg-surface-container text-on-surface'}`}>
                        {log.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-on-surface-variant mt-0.5">{log.description}</p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
                {log.timestamp}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
