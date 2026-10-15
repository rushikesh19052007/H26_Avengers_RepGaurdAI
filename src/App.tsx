/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WorkspaceView, DependencyItem, ScannedRepositoryData } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { ScanningProgressView } from './components/ScanningProgressView';
import { OverviewView } from './components/OverviewView';
import { RepositoryScannerView } from './components/RepositoryScannerView';
import { DependencyRisksView } from './components/DependencyRisksView';
import { MigrationAssistantView } from './components/MigrationAssistantView';
import { TestVerificationView } from './components/TestVerificationView';
import { ExitCapsulesView } from './components/ExitCapsulesView';
import { ActivityLogsView } from './components/ActivityLogsView';
import { SettingsAndDocsView } from './components/SettingsAndDocsView';
import { QuickScanModal } from './components/QuickScanModal';

export default function App() {
  const [currentView, setCurrentView] = useState<WorkspaceView>('landing');
  const [scannedRepo, setScannedRepo] = useState<ScannedRepositoryData | null>(null);
  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [activeRepoUrl, setActiveRepoUrl] = useState<string>('');
  const [activeScanFile, setActiveScanFile] = useState<File | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<DependencyItem | null>(null);
  const [isQuickScanOpen, setIsQuickScanOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check URL params on initial load for direct routing or autostart
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as WorkspaceView;
    if (
      viewParam &&
      [
        'landing',
        'scanning',
        'overview',
        'repository-scanner',
        'dependency-risks',
        'ai-migration-assistant',
        'test-and-verification',
        'exit-capsules',
        'activity-logs',
        'settings',
        'help-and-docs',
      ].includes(viewParam)
    ) {
      setCurrentView(viewParam);
    }
  }, []);

  // Standalone Full-Page Views (Landing / Scanning Progress)
  if (currentView === 'landing') {
    return (
      <LandingView
        onStartScan={(repo, file) => {
          setActiveRepoUrl(repo || '');
          setActiveScanFile(file || null);
          setCurrentView('scanning');
        }}
        onSelectView={(v) => setCurrentView(v)}
      />
    );
  }

  if (currentView === 'scanning') {
    return (
      <ScanningProgressView
        repoUrl={activeRepoUrl}
        scanFile={activeScanFile}
        onCompleteScan={() => setCurrentView('overview')}
        onCancelScan={() => setCurrentView('landing')}
        onSelectView={(v) => setCurrentView(v)}
        onScanResult={(data) => {
          setScannedRepo(data);
          setDependencies(data.dependencies);
          if (data.dependencies.length > 0) {
            setSelectedDependency(data.dependencies[0]);
          }
        }}
      />
    );
  }

  // Dashboard Shell with Sidebar & Header
  return (
    <div className="min-h-screen bg-background font-sans text-on-surface antialiased flex">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="pl-0 lg:pl-60 flex-1 flex flex-col min-h-screen">
        <Header
          currentView={currentView}
          onSelectView={(v) => setCurrentView(v)}
          onTriggerScan={() => setIsQuickScanOpen(true)}
          onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
          scannedRepo={scannedRepo}
        />

        <main className="relative pt-16 bg-surface flex-1">
          <div className="w-full max-w-7xl mx-auto p-6 lg:p-8">
            {currentView === 'overview' && (
              <OverviewView
                onSelectView={(v) => setCurrentView(v)}
                dependencies={dependencies}
                scannedRepo={scannedRepo}
                onSelectDependency={(dep) => {
                  setSelectedDependency(dep);
                  setCurrentView('dependency-risks');
                }}
              />
            )}

            {currentView === 'repository-scanner' && (
              <RepositoryScannerView
                onSelectView={(v) => setCurrentView(v)}
                scannedRepo={scannedRepo}
                dependencies={dependencies}
              />
            )}

            {currentView === 'dependency-risks' && (
              <DependencyRisksView
                dependencies={dependencies}
                selectedDependency={selectedDependency || dependencies[0] || null}
                onSelectDependency={setSelectedDependency}
                onSelectView={(v) => setCurrentView(v)}
              />
            )}

            {currentView === 'ai-migration-assistant' && (
              <MigrationAssistantView
                selectedDependency={selectedDependency || dependencies[0] || null}
              />
            )}

            {currentView === 'test-and-verification' && (
              <TestVerificationView
                dependencies={dependencies}
                scannedRepo={scannedRepo}
              />
            )}

            {currentView === 'exit-capsules' && (
              <ExitCapsulesView
                dependencies={dependencies}
                scannedRepo={scannedRepo}
              />
            )}

            {currentView === 'activity-logs' && (
              <ActivityLogsView
                scannedRepo={scannedRepo}
                dependencies={dependencies}
              />
            )}

            {currentView === 'settings' && <SettingsAndDocsView initialTab="settings" />}

            {currentView === 'help-and-docs' && <SettingsAndDocsView initialTab="docs" />}
          </div>
        </main>
      </div>

      {/* Quick Scan Modal */}
      <QuickScanModal
        isOpen={isQuickScanOpen}
        onClose={() => setIsQuickScanOpen(false)}
        onRunFullScan={() => setCurrentView('landing')}
        scannedRepo={scannedRepo}
      />
    </div>
  );
}
