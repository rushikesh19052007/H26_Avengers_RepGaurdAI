import React, { useState } from 'react';
import { WorkspaceView, DependencyItem } from '../types';
import { filterDependencies } from '../utils/scanLogic';

interface DependencyRisksViewProps {
  selectedDependency?: DependencyItem | null;
  onSelectDependency: (dep: DependencyItem) => void;
  onSelectView: (view: WorkspaceView) => void;
  dependencies?: DependencyItem[];
}

export const DependencyRisksView: React.FC<DependencyRisksViewProps> = ({
  selectedDependency,
  onSelectDependency,
  onSelectView,
  dependencies = [],
}) => {
  const activeDep = selectedDependency || dependencies[0] || null;
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('All Risks');
  const [evidenceFilter, setEvidenceFilter] = useState('All Evidence');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Filter using pure scanLogic utility
  const filteredDependencies = filterDependencies(
    dependencies,
    searchQuery,
    riskFilter,
    evidenceFilter,
    statusFilter
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setRiskFilter('All Risks');
    setEvidenceFilter('All Evidence');
    setStatusFilter('All Statuses');
  };

  const handleExportCSV = () => {
    const headers = ['Dependency', 'Version', 'Risk Severity', 'Evidence Source', 'AST Usage', 'Status'];
    const rows = filteredDependencies.map((d) => [
      d.name,
      d.version,
      d.riskSeverity,
      d.evidenceSource,
      `${d.astCallSites} call sites`,
      d.statusDetails || d.status,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'depguard-dependency-risks.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">
              Dependency Risks
            </h1>
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-error-container text-on-error-container font-semibold border border-error/20">
              2 Critical Failures
            </span>
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-surface-container-high text-secondary border border-surface-container-high">
              Py 3.12 / 3.13 Matrix
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Review risk indicators, package usage, and supporting evidence across declared manifests
            and AST call graphs.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
          <button
            onClick={() => {
              setRiskFilter('High (2)');
            }}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium transition-colors cursor-pointer border border-surface-container-high/70"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">tune</span>
            <span>Filter Presets</span>
          </button>

          <button
            onClick={handleExportCSV}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium transition-colors cursor-pointer border border-surface-container-high/70"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              download
            </span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onSelectView('test-and-verification')}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary text-[13px] font-semibold hover:opacity-95 transition-opacity shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Run Verification</span>
          </button>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="p-2.5 rounded-xl bg-surface-container-lowest shadow-xs border border-surface-container-high/70 flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by package or file path..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface font-mono text-[12px] placeholder:text-outline focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:outline-none transition-colors border border-surface-container-high/60 shadow-inner"
            />
          </div>

          {/* Risk Level Dropdown */}
          <div className="relative">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[13px] focus:outline-none cursor-pointer border border-surface-container-high/60"
            >
              <option>All Risks</option>
              <option>High ({dependencies.filter((d) => d.riskSeverity === 'High').length})</option>
              <option>Needs Review ({dependencies.filter((d) => d.riskSeverity === 'Needs Review').length})</option>
              <option>Low ({dependencies.filter((d) => d.riskSeverity === 'Low').length})</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-outline">
              expand_more
            </span>
          </div>

          {/* Evidence Type Dropdown */}
          <div className="relative">
            <select
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[13px] focus:outline-none cursor-pointer border border-surface-container-high/60"
            >
              <option>All Evidence</option>
              <option>AST source matches</option>
              <option>PyPI metadata</option>
              <option>CVE feed</option>
              <option>License checks</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-outline">
              expand_more
            </span>
          </div>

          {/* Verification Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[13px] focus:outline-none cursor-pointer border border-surface-container-high/60"
            >
              <option>All Statuses</option>
              <option>Verified</option>
              <option>Not tested</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-outline">
              expand_more
            </span>
          </div>
        </div>

        {/* Clear Filters Link */}
        <button
          onClick={handleResetFilters}
          type="button"
          className="self-end md:self-center px-2 py-1 text-on-surface-variant hover:text-primary text-[13px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          <span>Reset all</span>
        </button>
      </div>

      {/* Main Content Stage: 65% Table / 35% Drawer Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Side: Dependency Risk Table */}
        <div
          className={`${
            isDrawerOpen ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high/70 overflow-hidden flex flex-col transition-all`}
        >
          <div className="p-3.5 flex items-center justify-between bg-surface-container-low/60 border-b border-surface-container-high/50">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-on-surface">Tracked Dependencies</span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-surface-container-highest text-on-surface-variant font-medium">
                {filteredDependencies.length} audited
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-on-surface-variant">
              <span>Sort:</span>
              <button
                type="button"
                className="font-semibold text-primary inline-flex items-center gap-0.5 cursor-pointer"
              >
                Risk Severity <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/40 text-on-surface-variant font-mono text-[11px] uppercase border-b border-surface-container-high/50">
                  <th className="py-2.5 px-4 font-medium">Dependency</th>
                  <th className="py-2.5 px-3 font-medium">Version</th>
                  <th className="py-2.5 px-3 font-medium">Risk Signal</th>
                  <th className="py-2.5 px-3 font-medium">Evidence Source</th>
                  <th className="py-2.5 px-3 font-medium">AST Usage</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-[13px]">
                {filteredDependencies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px] block mb-2 opacity-40">
                        inventory_2
                      </span>
                      <p className="text-[14px] font-medium text-on-surface">No dependencies found</p>
                      <p className="text-[12px] text-on-surface-variant mt-1">
                        {dependencies.length === 0
                          ? 'This repository does not declare dependencies or scan is empty.'
                          : 'No packages match the current search or risk filters.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredDependencies.map((dep) => {
                  const isSelected = activeDep?.id === dep.id;
                  return (
                    <tr
                      key={dep.id}
                      onClick={() => {
                        onSelectDependency(dep);
                        setIsDrawerOpen(true);
                      }}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-surface-container-high/60 border-l-4 border-l-primary'
                          : 'hover:bg-surface-container-low/60'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              dep.riskSeverity === 'High'
                                ? 'bg-error'
                                : dep.riskSeverity === 'Needs Review'
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`}
                          ></span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-[13px] font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {dep.name}
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">
                              {dep.ecosystem}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-surface-container-high">
                          {dep.version}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <span
                            className={`inline-flex items-center w-fit px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold ${
                              dep.riskSeverity === 'High'
                                ? 'bg-error-container text-on-error-container'
                                : dep.riskSeverity === 'Needs Review'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {dep.riskSeverity}
                          </span>
                          <span className="text-on-surface-variant text-[11px] leading-tight line-clamp-2">
                            {dep.riskReason}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 font-mono text-[12px] text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">
                            code
                          </span>
                          <span className="truncate max-w-[110px]" title={dep.evidenceSource}>
                            {dep.evidenceSource}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-medium whitespace-nowrap border border-surface-container-high">
                          {dep.astCallSites} call sites
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {dep.status === 'Failed' ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-error font-medium">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            {dep.statusDetails || 'Failed Py3.13'}
                          </span>
                        ) : dep.status === 'Verified' ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 font-medium">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            {dep.statusDetails || 'Verified'}
                          </span>
                        ) : dep.status === 'Pending' ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-tertiary-container font-medium">
                            <span className="material-symbols-outlined text-[14px] animate-spin">
                              sync
                            </span>
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-outline font-medium">
                            <span className="material-symbols-outlined text-[14px]">
                              remove_circle_outline
                            </span>
                            Not tested
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDependency(dep);
                            setIsDrawerOpen(true);
                          }}
                          className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold transition-opacity cursor-pointer ${
                            isSelected
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-surface-container-high'
                          }`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          {/* Table Micro-Footer */}
          <div className="p-3 bg-surface-container-low/30 border-t border-surface-container-high/50 flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span>AST indexing active on branch &apos;main&apos;</span>
            </div>
            <span>{filteredDependencies.length} items shown</span>
          </div>
        </div>

        {/* Right Side: Open Evidence Inspection Drawer */}
        {isDrawerOpen && activeDep && (
          <div className="xl:col-span-5 bg-surface-container-lowest rounded-xl shadow-md border border-surface-container-high/80 p-5 flex flex-col gap-4">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-semibold text-on-surface">
                    Package Evidence: {activeDep.name}
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface border border-surface-container-high">
                    v{activeDep.version}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-error font-semibold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  {activeDep.riskSeverity === 'High'
                    ? 'Critical Migration Blocker'
                    : 'Advisory Review Item'}
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
                title="Close drawer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Section 1: Package Overview */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-semibold">
                1. Package Overview
              </span>
              <div className="p-3 rounded-lg bg-surface-container-low grid grid-cols-2 gap-3 text-[12px] border border-surface-container-high/50">
                <div>
                  <span className="text-on-surface-variant block font-mono text-[10px]">
                    Ecosystem
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-on-surface">
                    {activeDep.ecosystem}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-mono text-[10px]">
                    Declared Manifest
                  </span>
                  <span className="font-mono text-[12px] text-on-surface">
                    {activeDep.declaredManifest}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-surface-container-high/40">
                  <span className="text-on-surface-variant block font-mono text-[10px]">
                    Usage Graph
                  </span>
                  <span className="font-mono text-[12px] text-on-surface font-medium">
                    {activeDep.astCallSites} AST call sites resolved across{' '}
                    {activeDep.astFiles} files
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Concrete Risk Evidence */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-semibold">
                  2. Concrete Risk Evidence
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-secondary font-medium">
                  Rigid telemetry
                </span>
              </div>

              <div className="flex flex-col gap-2 text-[12px]">
                {activeDep.facts.map((fact, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-surface-container-low flex items-start gap-2 border border-surface-container-high/40"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold flex-shrink-0 ${
                        fact.isWarning
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {fact.type}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-on-surface text-[12px] leading-relaxed">
                        {fact.text}
                      </span>
                      {fact.codeHighlight && (
                        <code className="font-mono text-[11px] text-error bg-surface-container px-1.5 py-0.5 rounded mt-1 font-medium w-fit">
                          {fact.codeHighlight}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: AST Source Usage Locations */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-semibold">
                  3. AST Source Usage Locations
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant font-medium">
                  {activeDep.astFiles} files
                </span>
              </div>

              <div className="rounded-lg bg-surface-container-low overflow-hidden border border-surface-container-high/60">
                {activeDep.codeSnippets.map((snip, idx) => (
                  <div key={idx} className={idx > 0 ? 'border-t border-surface-container-high/50' : ''}>
                    <div className="px-3 py-1 bg-surface-container flex items-center justify-between text-on-surface font-mono text-[11px]">
                      <span className="font-semibold text-primary">{snip.file}</span>
                      <span className="text-on-surface-variant font-mono text-[10px]">
                        {snip.purpose}
                      </span>
                    </div>
                    <div className="p-3 font-mono text-[11px] text-on-surface leading-relaxed overflow-x-auto bg-surface-container-lowest/90 whitespace-pre">
                      {snip.code}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Gemma 4 AI Analysis & Proposed Next Step */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-semibold">
                  4. Gemma 4 AI Analysis
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                  {Math.round(activeDep.migrationRecommendation.confidence * 100)}% Confidence
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high/60 flex flex-col gap-2 border border-primary/20">
                <div className="flex items-center gap-1.5 text-primary text-[14px] font-semibold">
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  <span>{activeDep.migrationRecommendation.title}</span>
                </div>
                <p className="text-[12px] text-on-surface leading-relaxed">
                  {activeDep.migrationRecommendation.description}
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] text-primary">speed</span>
                  <span>
                    Estimated synthesis time:{' '}
                    {activeDep.migrationRecommendation.estimatedSynthesisTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer CTAs */}
            <div className="pt-3 mt-auto flex flex-col sm:flex-row items-center gap-2.5 border-t border-surface-container-high/60">
              <button
                onClick={() => onSelectView('ai-migration-assistant')}
                type="button"
                className="w-full sm:flex-1 py-2 px-3 rounded-lg bg-primary-container hover:opacity-95 text-on-primary text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">auto_mode</span>
                <span>Analyze in AI Assistant</span>
              </button>

              <a
                href={`https://pypi.org/project/${activeDep.name}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  open_in_new
                </span>
                <span>PyPI Package</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
