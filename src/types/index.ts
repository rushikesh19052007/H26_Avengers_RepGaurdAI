export type WorkspaceView =
  | 'landing'
  | 'scanning'
  | 'overview'
  | 'repository-scanner'
  | 'dependency-risks'
  | 'ai-migration-assistant'
  | 'test-and-verification'
  | 'exit-capsules'
  | 'activity-logs'
  | 'settings'
  | 'help-and-docs';

export interface CodeSnippet {
  file: string;
  line: number;
  purpose: string;
  code: string;
}

export interface RiskFact {
  type: 'OBSERVED' | 'INFERRED';
  isWarning?: boolean;
  text: string;
  codeHighlight?: string;
}

export interface DependencyItem {
  id: string;
  name: string;
  ecosystem: string;
  version: string;
  targetVersion?: string;
  riskSeverity: 'High' | 'Needs Review' | 'Low';
  riskReason: string;
  evidenceSource: string;
  declaredManifest: string;
  astCallSites: number;
  astFiles: number;
  status: 'Verified' | 'Not tested' | 'Failed' | 'Pending';
  statusDetails?: string;
  codeSnippets: CodeSnippet[];
  facts: RiskFact[];
  migrationRecommendation: {
    title: string;
    targetPackages: string[];
    description: string;
    confidence: number;
    estimatedSynthesisTime: string;
    astTransformAvailable: boolean;
    diffSnippet?: {
      original: string;
      replacement: string;
    };
  };
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  type: 'scan' | 'migration' | 'test' | 'capsule' | 'manifest';
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

export interface InspectionStage {
  id: string;
  stageNumber: string;
  name: string;
  detail: string;
  status: 'completed' | 'active' | 'queued';
  latency?: string;
}

export interface ScannedRepositoryData {
  id: string;
  name: string;
  url: string;
  branch: string;
  visibility: string;
  lastScanned: string;
  pythonRuntime: string;
  files: string[];
  manifestName: string;
  manifestContent: string;
  dependencies: DependencyItem[];
  summary: {
    total: number;
    highRisk: number;
    needsReview: number;
    healthy: number;
    astCallSites: number;
    scannedFilesCount: number;
    verifiedPassing: number;
  };
  activityLogs: ActivityLogItem[];
  limitations?: string[];
  source: 'backend' | 'github' | 'zip' | 'local';
}

export * from './api';
