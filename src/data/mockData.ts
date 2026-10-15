import { DependencyItem, ActivityLogItem, InspectionStage } from '../types';

export const DEPGUARD_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1W-w51ytOlPIH4jvnlx7cumHvnLoizkC--AkSOpy9HxCXkU9eVGuIFXQDje2XDC0DICPrMP2I7nKeZ3wbWiJyb5Ccldqt-Xt5G10QHMjLMpMuDn9ryaP1VocndGTRVYWwLO55kHekk7qtF6TM_y05YhwagX87Uk3UhhbeVNLDscVRWQcKccrVrs7zaU7rmyIsrbETHwX46lzRdZSyUo3ogu881d3gLrnqHBcARwRuP8BvN5n03qjPzXzFQ';

// Pure production mode: No hardcoded mock datasets
export const TRACKED_DEPENDENCIES: DependencyItem[] = [];
export const ACTIVITY_LOGS: ActivityLogItem[] = [];
export const SCANNER_PIPELINE_STAGES: InspectionStage[] = [];
