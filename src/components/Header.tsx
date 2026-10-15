import React from 'react';
import { WorkspaceView, ScannedRepositoryData } from '../types';
import { useBackendHealth } from '../services/depguardApi';

interface HeaderProps {
  currentView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onTriggerScan: () => void;
  onToggleMobileMenu?: () => void;
  scannedRepo?: ScannedRepositoryData | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  onTriggerScan,
  onToggleMobileMenu,
  scannedRepo,
}) => {
  const { isOnline, serviceInfo, isChecking, refetch, baseUrl } = useBackendHealth();

  const getViewName = (view: WorkspaceView) => {
    switch (view) {
      case 'overview':
        return 'Overview';
      case 'repository-scanner':
        return 'Repository Scanner';
      case 'dependency-risks':
        return 'Dependency Risks';
      case 'ai-migration-assistant':
        return 'AI Migration Assistant';
      case 'test-and-verification':
        return 'Test & Verification';
      case 'exit-capsules':
        return 'Exit Capsules';
      case 'activity-logs':
        return 'Activity Logs';
      case 'settings':
        return 'Settings';
      case 'help-and-docs':
        return 'Help & Docs';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-16 px-4 lg:px-8 flex items-center justify-between">
        {/* Mobile Hamburger & Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[13px] text-on-surface-variant">
            <button
              onClick={() => onSelectView('landing')}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              RepGuard AI
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <button
              onClick={() => onSelectView('repository-scanner')}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer truncate max-w-xs"
            >
              {scannedRepo?.name || 'Repository'}
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-on-surface font-semibold">{getViewName(currentView)}</span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-surface-container text-on-surface border border-surface-container-high hidden sm:inline-block">
            Target: {scannedRepo?.pythonRuntime || 'Python 3.12/3.13'}
          </span>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-3">
          {/* Backend API Connection Indicator */}
          <button
            onClick={refetch}
            type="button"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all cursor-pointer shadow-xs ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20'
            }`}
            title={
              isOnline
                ? `Backend Online at ${baseUrl} (${serviceInfo?.service || 'DepGuard AI'}). Click to recheck.`
                : `Backend Offline (${baseUrl}). Running in Standalone/Demo mode. Click to recheck.`
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {isChecking
                ? 'Checking API...'
                : isOnline
                ? 'API: 8000 Online'
                : 'API: Standalone Mode'}
            </span>
          </button>

          <div className="hidden md:flex items-center gap-3 text-[13px]">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-on-surface font-medium">Gemma 4: Ready</span>
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant">
              Last Scan: 14m ago
            </span>
          </div>

          <button
            onClick={onTriggerScan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary-container text-[13px] font-semibold hover:bg-primary-container hover:text-on-primary transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">search_check</span>
            <span>Scan Now</span>
          </button>

          <button
            onClick={() => onSelectView('help-and-docs')}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            title="Documentation"
            aria-label="View documentation"
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
          </button>

          <button
            onClick={() => onSelectView('settings')}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-on-primary shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            title="User Profile"
            aria-label="User profile settings"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>
        </div>
      </div>
    </header>
  );
};
