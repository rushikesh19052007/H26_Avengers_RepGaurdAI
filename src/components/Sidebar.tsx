import React from 'react';
import { WorkspaceView } from '../types';
import { DepGuardLogo } from './DepGuardLogo';

interface SidebarProps {
  currentView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'overview' as WorkspaceView, label: 'Overview', icon: 'space_dashboard' },
    { id: 'repository-scanner' as WorkspaceView, label: 'Repository Scanner', icon: 'document_scanner' },
    {
      id: 'dependency-risks' as WorkspaceView,
      label: 'Dependency Risks',
      icon: 'gpp_maybe',
      badge: '2',
      badgeClass: 'bg-error-container text-on-error-container',
    },
    { id: 'ai-migration-assistant' as WorkspaceView, label: 'AI Migration Assistant', icon: 'auto_mode' },
    { id: 'test-and-verification' as WorkspaceView, label: 'Test & Verification', icon: 'science' },
    { id: 'exit-capsules' as WorkspaceView, label: 'Exit Capsules', icon: 'task_alt' },
    { id: 'activity-logs' as WorkspaceView, label: 'Activity Logs', icon: 'history' },
  ];

  const bottomItems = [
    { id: 'settings' as WorkspaceView, label: 'Settings', icon: 'settings' },
    { id: 'help-and-docs' as WorkspaceView, label: 'Help & Docs', icon: 'help' },
  ];

  const handleNavClick = (view: WorkspaceView) => {
    onSelectView(view);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-60 bg-surface-container-lowest z-50 flex flex-col justify-between border-r border-surface-container-high/60 overflow-y-auto transition-transform duration-200 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Application navigation"
      >
        <div className="flex flex-col">
          {/* App Title & Logo */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <button
              onClick={() => handleNavClick('landing')}
              className="flex items-center gap-2.5 text-left w-full hover:opacity-90 transition-opacity cursor-pointer group"
              title="Return to Landing / Import Screen"
            >
              <DepGuardLogo size={32} />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[16px] text-on-surface truncate leading-none group-hover:text-primary transition-colors">
                  DepGuard AI
                </span>
                <span className="text-[12px] text-on-surface-variant truncate mt-1">
                  Dependency Resilience
                </span>
              </div>
            </button>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>

          {/* Workspace Project Selector */}
          <div className="px-3 py-1">
            <div
              onClick={() => handleNavClick('landing')}
              className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer group border border-surface-container-high/40"
              title="Switch Target Repository"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant flex-shrink-0 group-hover:text-primary transition-colors">
                  deployed_code
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] text-on-surface font-semibold truncate">
                      LinkWatch
                    </span>
                    <span className="text-[11px] font-mono px-1 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                      main
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="text-[11px] font-mono text-on-surface-variant">
                      Ready / Scanned
                    </span>
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant flex-shrink-0">
                unfold_more
              </span>
            </div>
          </div>

          {/* Main Workspace Navigation */}
          <div className="px-3 py-2">
            <span className="px-2 font-mono text-[11px] uppercase text-on-surface-variant tracking-wider font-semibold">
              Workspace
            </span>
            <nav className="flex flex-col gap-0.5 mt-1.5" aria-label="Workspace links">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer text-left w-full ${
                      isActive
                        ? 'bg-primary-container text-on-primary font-semibold shadow-xs'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && !isActive && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${item.badgeClass}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Divider */}
          <div className="h-px mx-3 bg-surface-container-high my-1"></div>

          {/* Settings & Help */}
          <div className="px-3 py-1">
            <nav className="flex flex-col gap-0.5" aria-label="Support and preferences">
              {bottomItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer text-left w-full ${
                      isActive
                        ? 'bg-primary-container text-on-primary font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Engine Status Card at bottom */}
        <div className="p-3">
          <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5 border border-surface-container-high/60">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-on-surface-variant font-medium">ENGINE</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary-container text-on-primary font-semibold">
                Local 9B
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </div>
              <span className="text-[13px] text-on-surface font-medium truncate">Gemma 4</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-on-surface-variant pt-0.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">bolt</span> 34ms
              </span>
              <span className="text-primary-container font-semibold">Hacktoberfest &apos;26</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
