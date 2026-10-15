import React from 'react';
import { ScannedRepositoryData } from '../types';

interface QuickScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunFullScan: () => void;
  scannedRepo?: ScannedRepositoryData | null;
}

export const QuickScanModal: React.FC<QuickScanModalProps> = ({
  isOpen,
  onClose,
  onRunFullScan,
  scannedRepo,
}) => {
  if (!isOpen) return null;

  const repoName = scannedRepo?.name || 'Active Repository';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-container-high flex flex-col gap-4 transform transition-all">
        <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-on-surface">DepGuard AI Scanner</h3>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Target: {repoName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-on-surface-variant leading-relaxed">
            Run deterministic manifest discovery, Python AST usage mapping, and Gemma 4 AI resilience analysis.
          </p>

          <div className="p-3.5 rounded-lg bg-surface-container-low font-mono text-[12px] text-on-surface border border-surface-container-high/60 space-y-1">
            <div className="flex items-center justify-between text-on-surface-variant font-semibold">
              <span>SCAN CONFIGURATION</span>
              <span className="text-primary font-semibold">Active</span>
            </div>
            <div className="text-[11px] text-on-surface-variant">Model: Gemma 4 (Thinking Level: High)</div>
            <div className="text-[11px] text-on-surface-variant">Target Runtime: Python 3.12 / 3.13</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high/60">
          <button
            onClick={onClose}
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[13px] font-medium cursor-pointer border border-surface-container-high"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              onRunFullScan();
            }}
            type="button"
            className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-[13px] font-semibold cursor-pointer shadow-xs hover:bg-primary-container flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Launch Scanner Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
