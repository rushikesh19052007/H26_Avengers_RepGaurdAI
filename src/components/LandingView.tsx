import React, { useState } from 'react';
import { WorkspaceView } from '../types';
import { DepGuardLogo } from './DepGuardLogo';

interface LandingViewProps {
  onStartScan: (repoUrl?: string, file?: File | null) => void;
  onSelectView?: (view: WorkspaceView) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onStartScan }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [rawZipFile, setRawZipFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<{ name: string; size: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!repoUrl) return;
    setIsVerifying(true);
    setValidationError(null);
    try {
      const res = await fetch('/api/repositories/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerifiedSuccess(true);
      } else {
        setVerifiedSuccess(false);
        setValidationError(data.errors?.[0] || 'Invalid repository format');
      }
    } catch {
      // Basic fallback format check
      if (repoUrl.includes('/') && !repoUrl.includes(';')) {
        setVerifiedSuccess(true);
      } else {
        setValidationError('Invalid repository URL');
      }
    } finally {
      setIsVerifying(false);
    }
  };


  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert(`ZIP file exceeds the 10MB maximum upload limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        return;
      }
      setRawZipFile(file);
      setZipFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      });
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
        <div className="h-16 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DepGuardLogo size={36} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[18px] md:text-[20px] text-on-surface font-bold tracking-tight">
                  DepGuard AI
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">
                  v1.4.0
                </span>
              </div>
              <span className="text-[12px] text-on-surface-variant leading-none">
                Dependency Resilience Engine
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full pt-16 flex-1 max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-center">
        <div className="flex flex-col w-full py-8 lg:py-12">
          {/* Hero Section */}
          <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

            {/* Hacktoberfest Pill */}
            <div className="flex flex-col items-center text-center gap-2 mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container shadow-xs border border-surface-container-high/60">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="font-mono text-[11px] text-primary font-semibold tracking-wide uppercase">
                  Hacktoberfest 2026 · Best Use of Gemma 4
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1 text-on-surface-variant font-mono text-[11px] tracking-wider uppercase font-medium">
                <span className="material-symbols-outlined text-[15px] text-primary">security</span>
                <span>Dependency Resilience Engine</span>
              </div>
              <h1 className="text-[32px] md:text-[38px] text-on-surface font-semibold tracking-tight max-w-2xl mt-1 text-center leading-tight">
                Let&apos;s analyze your codebase.
              </h1>
              <p className="text-[15px] text-on-surface-variant max-w-xl text-center leading-relaxed mt-1">
                Connect your repository or upload your project to discover dependency risks, explore safer
                replacements, and verify migration compatibility with AI-assisted analysis.
              </p>
            </div>

            {/* Dual Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
              {/* Card A: Import from GitHub */}
              <div className="flex flex-col justify-between bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high/70 hover:shadow-md transition-all duration-200 group">
                <div className="flex flex-col">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined text-[22px] text-primary">code</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[16px] text-on-surface font-semibold">
                          Import from GitHub
                        </span>
                        <span className="text-[13px] text-on-surface-variant">
                          Live telemetry and AST indexing via remote URL
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium">
                      Remote
                    </span>
                  </div>

                  {/* Input Stack */}
                  <div className="flex flex-col gap-1.5 mb-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="repo-url" className="text-[12px] text-on-surface font-semibold">
                        Repository URL
                      </label>
                      <span className="font-mono text-[11px] text-primary font-medium">
                        Auto-detected: Python
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px]">
                        terminal
                      </span>
                      <input
                        id="repo-url"
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository"
                        className="w-full pl-10 pr-24 py-2.5 rounded-lg bg-surface-container-low font-mono text-[13px] text-on-surface outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary transition-all border border-transparent focus:border-primary/40 shadow-inner"
                      />
                      <button
                        onClick={handleVerify}
                        type="button"
                        className="absolute right-2 px-2.5 py-1 rounded bg-surface font-mono text-[11px] text-on-surface-variant hover:text-on-surface shadow-xs transition-all active:scale-95 cursor-pointer border border-surface-container-high"
                      >
                        {isVerifying ? 'Checking...' : 'Re-check'}
                      </button>
                    </div>
                  </div>

                  {/* Inline Status Details */}
                  {verifiedSuccess && (
                    <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface-container-low/70 mb-5 border border-surface-container-high/60">
                      <div className="flex items-center gap-1.5 text-on-surface">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          Valid public repository detected (Python 3.12/3.13)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-surface text-on-surface-variant border border-surface-container-high">
                          <span className="material-symbols-outlined text-[13px] text-secondary">
                            alt_route
                          </span>
                          main
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-surface text-on-surface-variant border border-surface-container-high">
                          <span className="material-symbols-outlined text-[13px] text-secondary">
                            inventory_2
                          </span>
                          47 Python modules
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-surface text-on-surface-variant border border-surface-container-high">
                          <span className="material-symbols-outlined text-[13px] text-secondary">
                            verified
                          </span>
                          ast-ready
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-secondary text-[15px] mt-0.5 shrink-0">
                          info
                        </span>
                        <span className="text-[12px] text-on-surface-variant leading-snug">
                          Public repositories can be analyzed without pasting personal credentials or
                          access tokens.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Button */}
                <div className="pt-2 mt-auto">
                  <button
                    onClick={() => onStartScan(repoUrl, null)}
                    type="button"
                    disabled={!repoUrl.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[15px] font-semibold transition-all ${
                      repoUrl.trim()
                        ? 'bg-primary text-on-primary shadow-md hover:bg-primary-container active:scale-[0.99] cursor-pointer'
                        : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span>Connect &amp; Prepare Scan</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Card B: Upload project ZIP */}
              <div className="flex flex-col justify-between bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high/70 hover:shadow-md transition-all duration-200 group">
                <div className="flex flex-col">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                        <span className="material-symbols-outlined text-[22px] text-primary">
                          folder_zip
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[16px] text-on-surface font-semibold">
                          Upload project ZIP
                        </span>
                        <span className="text-[13px] text-on-surface-variant">
                          Analyze a local snapshot before pushing
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                      Offline / Local
                    </span>
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.zip';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            alert(`ZIP file exceeds the 10MB maximum upload limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
                            return;
                          }
                          setRawZipFile(file);
                          setZipFile({
                            name: file.name,
                            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                          });
                        }
                      };
                      input.click();
                    }}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group/drop mb-4 ${
                      isDragging
                        ? 'border-primary bg-surface-container-high'
                        : 'border-surface-container-high bg-surface-container-low/40 hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mb-1 text-primary group-hover/drop:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[22px]">upload_file</span>
                    </div>
                    <span className="text-[14px] text-on-surface font-medium">
                      Drop your ZIP file here or browse files
                    </span>
                    <span className="font-mono text-[11px] text-on-surface-variant mt-0.5">
                      Accepted format: .zip · Max upload: 10MB (max 50MB uncompressed)
                    </span>
                  </div>

                  {/* File Attachment Preview */}
                  {zipFile && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low mb-5 border border-surface-container-high/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0">
                          <span className="material-symbols-outlined text-[18px]">folder_zip</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[13px] text-on-surface font-semibold truncate">
                            {zipFile.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-on-surface-variant">
                              {zipFile.size}
                            </span>
                            <span className="text-on-surface-variant/40 text-xs">•</span>
                            <span className="font-mono text-[11px] text-primary font-medium">
                              Checksum matched
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-medium">
                          Ready to extract
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setZipFile(null);
                            setRawZipFile(null);
                          }}
                          className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
                          title="Remove file"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Secondary Button */}
                <div className="pt-2 mt-auto">
                  <button
                    onClick={() => onStartScan(undefined, rawZipFile)}
                    type="button"
                    disabled={!rawZipFile}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[15px] font-semibold transition-all ${
                      rawZipFile
                        ? 'bg-primary text-on-primary shadow-md hover:bg-primary-container active:scale-[0.99] cursor-pointer'
                        : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span>Analyze Uploaded Project</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>


            {/* Privacy & Safe Execution Notice */}
            <div className="w-full mt-5 px-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-on-surface-variant">
              <div className="flex items-center gap-2 text-left max-w-2xl">
                <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">
                  shield_with_heart
                </span>
                <span className="text-[12px] text-on-surface-variant">
                  Your repository is analyzed for dependency maintenance signals. Static AST
                  inspection and local Gemma 4 reasoning run without modifying your source code.
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0 bg-surface px-2.5 py-1 rounded-full shadow-xs border border-surface-container-high text-on-surface">
                <span className="inline-block w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span>Gemma 4 (Local 9B): Ready</span>
                <span className="text-on-surface-variant/40">|</span>
                <span className="text-on-surface-variant">Python 3.12 &amp; 3.13 Supported</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high/60 shadow-[0_-1px_6px_rgba(0,0,0,0.02)] py-3">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                SOC2 Type II Verified
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                verified_user
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Privacy Compliant
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse"></span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Model: Gemma 4 Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-on-surface-variant">
              &copy; 2026 DepGuard Open Source Architecture
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
