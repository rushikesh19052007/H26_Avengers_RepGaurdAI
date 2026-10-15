import React, { useState } from 'react';

interface SettingsAndDocsViewProps {
  initialTab?: 'settings' | 'docs';
}

export const SettingsAndDocsView: React.FC<SettingsAndDocsViewProps> = ({
  initialTab = 'docs',
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'docs'>(initialTab);
  const [engineModel, setEngineModel] = useState('gemma-4-9b-local');
  const [pythonTarget, setPythonTarget] = useState('3.12-3.13');

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] text-on-surface font-semibold tracking-tight">
              {activeTab === 'settings' ? 'Project Settings' : 'Hacktoberfest 2026 Documentation'}
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium border border-surface-container-high">
              DepGuard v1.4.0
            </span>
          </div>
          <p className="text-[14px] text-on-surface-variant">
            Engine parameters, Python runtime matrices, and Hacktoberfest submission details.
          </p>
        </div>

        <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-surface-container-high/60">
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1 rounded text-[13px] transition-all cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Documentation
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded text-[13px] transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'docs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex flex-col gap-3">
              <h2 className="text-[18px] font-semibold text-on-surface">
                Hacktoberfest 2026: Best Use of Gemma 4
              </h2>
              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                <strong>DepGuard AI</strong> is an automated dependency resilience and migration engine
                designed to prevent Python codebase decay across modern runtime version transitions
                (Python 3.12 and Python 3.13). By coupling static AST call-graph extraction with local
                quantized <strong>Gemma 4 (9B-Instruct)</strong> inference, DepGuard synthesizes
                zero-breaking-change migration diffs and executable test suites with no external
                telemetry leaks.
              </p>

              <div className="p-3 rounded-lg bg-surface-container-low font-mono text-[12px] text-on-surface border border-surface-container-high/60 leading-relaxed">
                <div className="text-primary font-semibold">Key Capabilities:</div>
                <ul className="list-disc list-inside mt-1 space-y-1 text-on-surface-variant">
                  <li>Direct parsing of requirements.txt &amp; pyproject.toml</li>
                  <li>Deep Abstract Syntax Tree (AST) traversal across 47+ modules</li>
                  <li>Automated discovery of deprecated distutils and asyncio event loops</li>
                  <li>Local Gemma 4 synthesized AST diffs (urlwatch → httpx + playwright-light)</li>
                  <li>Hermetic pytest test suite execution and validation sandbox</li>
                </ul>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex flex-col gap-3">
              <h3 className="text-[16px] font-semibold text-on-surface">
                Python 3.14 Alpha Policy Note
              </h3>
              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                In strict adherence to the DepGuard Handbook guidelines, experimental Python 3.14 alpha
                bytecode features are excluded from AST parsing graphs to ensure 100% deterministic,
                verifiable code synthesis.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase text-on-surface-variant font-semibold">
                Architecture Spec
              </span>
              <div className="flex flex-col gap-2 text-[12px] pt-1">
                <div className="flex justify-between border-b border-surface-container-high/50 pb-1.5">
                  <span className="text-on-surface-variant">Model</span>
                  <span className="font-mono font-semibold text-primary">Gemma 4 (Local 9B)</span>
                </div>
                <div className="flex justify-between border-b border-surface-container-high/50 pb-1.5">
                  <span className="text-on-surface-variant">Inference Latency</span>
                  <span className="font-mono text-on-surface font-semibold">34ms avg</span>
                </div>
                <div className="flex justify-between border-b border-surface-container-high/50 pb-1.5">
                  <span className="text-on-surface-variant">Throughput</span>
                  <span className="font-mono text-on-surface font-semibold">78 tok/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Target Runtime</span>
                  <span className="font-mono text-on-surface font-semibold">Python 3.12/3.13</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs max-w-2xl flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-on-surface">AI Inference Engine</label>
            <select
              value={engineModel}
              onChange={(e) => setEngineModel(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-[13px] text-on-surface font-mono"
            >
              <option value="gemma-4-9b-local">Gemma 4 (Local 9B-Instruct, bfloat16) [Recommended]</option>
              <option value="cloud-gemini-fallback">Gemini 2.5 Flash (Server-Side Proxy)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-on-surface">Target Python Matrix</label>
            <select
              value={pythonTarget}
              onChange={(e) => setPythonTarget(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-[13px] text-on-surface font-mono"
            >
              <option value="3.12-3.13">Python 3.12 &amp; 3.13 (Handbook Default)</option>
              <option value="3.12-only">Python 3.12 Only</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-[13px] font-semibold cursor-pointer shadow-xs hover:bg-primary-container transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
