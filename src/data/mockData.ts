import { DependencyItem, ActivityLogItem, InspectionStage } from '../types';

export const DEPGUARD_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1W-w51ytOlPIH4jvnlx7cumHvnLoizkC--AkSOpy9HxCXkU9eVGuIFXQDje2XDC0DICPrMP2I7nKeZ3wbWiJyb5Ccldqt-Xt5G10QHMjLMpMuDn9ryaP1VocndGTRVYWwLO55kHekk7qtF6TM_y05YhwagX87Uk3UhhbeVNLDscVRWQcKccrVrs7zaU7rmyIsrbETHwX46lzRdZSyUo3ogu881d3gLrnqHBcARwRuP8BvN5n03qjPzXzFQ';

export const TRACKED_DEPENDENCIES: DependencyItem[] = [
  {
    id: 'urlwatch',
    name: 'urlwatch',
    ecosystem: 'PyPI (Python)',
    version: '2.24',
    targetVersion: 'httpx + playwright-light',
    riskSeverity: 'High',
    riskReason: 'Upstream unmaintained (>24 mo), setup.py distutils syntax error',
    evidenceSource: 'worker.py:44',
    declaredManifest: 'requirements.txt:14',
    astCallSites: 9,
    astFiles: 2,
    status: 'Failed',
    statusDetails: 'Failed Py3.13',
    facts: [
      {
        type: 'OBSERVED',
        text: 'Manifest lock pins exact requirement urlwatch==2.24 without dynamic ceiling.',
      },
      {
        type: 'OBSERVED',
        isWarning: true,
        text: 'Last upstream commit: Oct 2023. Python 3.13 build fails during setup:',
        codeHighlight: "ModuleNotFoundError: No module named 'distutils'",
      },
      {
        type: 'OBSERVED',
        text: 'Python 3.14 explicitly incompatible per engineering target guidelines.',
      },
    ],
    codeSnippets: [
      {
        file: 'linkwatch/worker.py:44',
        line: 44,
        purpose: 'Job instantiation',
        code: `from urlwatch.handler import JobHandler
# Line 44: Direct invocation
handler = JobHandler(url=target_url, timeout=30)`,
      },
      {
        file: 'linkwatch/worker.py:112',
        line: 112,
        purpose: 'Execution trigger',
        code: `results = handler.run_job_checks()`,
      },
    ],
    migrationRecommendation: {
      title: 'Migration Capsule Available',
      targetPackages: ['httpx', 'playwright-light'],
      description:
        'Migrate directly to httpx + playwright-light. AST transformer can rewrite all 9 invocation points to resilient asynchronous fetch hooks with zero runtime regressions.',
      confidence: 94,
      estimatedSynthesisTime: '4.2 seconds',
      astTransformAvailable: true,
      diffSnippet: {
        original: `- from urlwatch.handler import JobHandler
- handler = JobHandler(url=target_url, timeout=30)
- results = handler.run_job_checks()`,
        replacement: `+ import httpx
+ async with httpx.AsyncClient(timeout=30.0) as client:
+     response = await client.get(target_url)
+     results = parse_payload_checks(response.text)`,
      },
    },
  },
  {
    id: 'requests-cache',
    name: 'requests-cache',
    ecosystem: 'PyPI (Python)',
    version: '0.9.1',
    targetVersion: '1.2.0',
    riskSeverity: 'Needs Review',
    riskReason: 'SQLite backend hook deprecated; thread-safety warning',
    evidenceSource: 'storage.py:82',
    declaredManifest: 'requirements.txt:18',
    astCallSites: 14,
    astFiles: 1,
    status: 'Verified',
    statusDetails: 'Verified (v1.2)',
    facts: [
      {
        type: 'OBSERVED',
        text: 'SQLite backend hook in link_checker.py uses deprecated threading context.',
      },
      {
        type: 'OBSERVED',
        text: 'Upgrade to requests-cache>=1.2.0 is backwards-compatible with active database tables.',
      },
    ],
    codeSnippets: [
      {
        file: 'linkwatch/storage.py:82',
        line: 82,
        purpose: 'Cache session init',
        code: `session = CachedSession(
    cache_name='linkwatch_cache',
    backend='sqlite',
    expire_after=3600
)`,
      },
    ],
    migrationRecommendation: {
      title: 'Seamless Safe Upgrade',
      targetPackages: ['requests-cache>=1.2.0'],
      description:
        'Modernized backend connection pooling with thread-local SQLite connector. Safe in-place upgrade.',
      confidence: 98,
      estimatedSynthesisTime: '1.8 seconds',
      astTransformAvailable: true,
      diffSnippet: {
        original: `- from requests_cache import CachedSession
- session = CachedSession(cache_name='linkwatch_cache', backend='sqlite')`,
        replacement: `+ from requests_cache import CachedSession, SQLiteCache
+ session = CachedSession(backend=SQLiteCache('linkwatch_cache.sqlite', use_temp=False))`,
      },
    },
  },
  {
    id: 'minidb',
    name: 'minidb',
    ecosystem: 'PyPI (Python)',
    version: '2.0.8',
    targetVersion: 'sqlite3-native',
    riskSeverity: 'High',
    riskReason: 'Abandoned by maintainer; pure distutils reliance',
    evidenceSource: 'db.py:12',
    declaredManifest: 'requirements.txt:26',
    astCallSites: 3,
    astFiles: 1,
    status: 'Not tested',
    statusDetails: 'Not tested',
    facts: [
      {
        type: 'OBSERVED',
        isWarning: true,
        text: 'PyPI package abandoned 4 years ago. No binary wheels published for Python 3.12+.',
      },
      {
        type: 'OBSERVED',
        text: 'Only 3 call sites in linkwatch/db.py: simple schema KV storage.',
      },
    ],
    codeSnippets: [
      {
        file: 'linkwatch/db.py:12',
        line: 12,
        purpose: 'Database connect',
        code: `import minidb
db = minidb.Store('linkwatch.db')
db.register(SchemaRecord)`,
      },
    ],
    migrationRecommendation: {
      title: 'Native SQLite Shim Recommended',
      targetPackages: ['sqlite3 (stdlib)'],
      description:
        'Drop the external minidb dependency entirely. AST transformer rewrites calls to Python stdlib sqlite3.',
      confidence: 96,
      estimatedSynthesisTime: '2.1 seconds',
      astTransformAvailable: true,
      diffSnippet: {
        original: `- import minidb
- db = minidb.Store('linkwatch.db')`,
        replacement: `+ import sqlite3
+ conn = sqlite3.connect('linkwatch.db')`,
      },
    },
  },
  {
    id: 'apprise',
    name: 'apprise',
    ecosystem: 'PyPI (Python)',
    version: '1.7.0',
    targetVersion: '1.9.0',
    riskSeverity: 'Needs Review',
    riskReason: 'Async loop deprecation warning in Python 3.13',
    evidenceSource: 'PyPI / notify.py',
    declaredManifest: 'requirements.txt:31',
    astCallSites: 6,
    astFiles: 1,
    status: 'Pending',
    statusDetails: 'Pending verification',
    facts: [
      {
        type: 'OBSERVED',
        text: 'Async loop get_event_loop() warning raised on Python 3.13 during notification dispatch.',
      },
      {
        type: 'OBSERVED',
        text: 'Apprise upstream released v1.9.0 containing Python 3.13 asyncio event loop patch.',
      },
    ],
    codeSnippets: [
      {
        file: 'linkwatch/notify.py:108',
        line: 108,
        purpose: 'Notification dispatch',
        code: `apobj = apprise.Apprise()
apobj.add('discord://...')
apobj.notify(body=alert_msg, title='LinkWatch Alert')`,
      },
    ],
    migrationRecommendation: {
      title: 'Version Bump to v1.9.0',
      targetPackages: ['apprise>=1.9.0'],
      description:
        'Compatible update fixing asyncio deprecation warnings without modifying caller syntax.',
      confidence: 99,
      estimatedSynthesisTime: '1.2 seconds',
      astTransformAvailable: true,
      diffSnippet: {
        original: `- apprise==1.7.0`,
        replacement: `+ apprise>=1.9.0`,
      },
    },
  },
  {
    id: 'beautifulsoup4',
    name: 'beautifulsoup4',
    ecosystem: 'PyPI (Python)',
    version: '4.12.3',
    riskSeverity: 'Low',
    riskReason: 'Up to date, verified clean in Python 3.12/3.13',
    evidenceSource: 'parser.py:15',
    declaredManifest: 'requirements.txt:22',
    astCallSites: 22,
    astFiles: 2,
    status: 'Verified',
    statusDetails: 'Verified Clean',
    facts: [
      {
        type: 'OBSERVED',
        text: 'Active upstream maintenance. All 22 AST call sites pass strict AST syntax parsing.',
      },
    ],
    codeSnippets: [
      {
        file: 'linkwatch/parser.py:15',
        line: 15,
        purpose: 'HTML DOM traversal',
        code: `from bs4 import BeautifulSoup
soup = BeautifulSoup(html_content, 'html.parser')
links = [a['href'] for a in soup.find_all('a', href=True)]`,
      },
    ],
    migrationRecommendation: {
      title: 'Healthy Dependency',
      targetPackages: ['beautifulsoup4==4.12.3'],
      description: 'No action required. Dependency is healthy and fully compatible.',
      confidence: 100,
      estimatedSynthesisTime: '0 seconds',
      astTransformAvailable: false,
    },
  },
];

export const ACTIVITY_LOGS: ActivityLogItem[] = [
  {
    id: 'log-1',
    timestamp: '14:32:10 UTC',
    type: 'scan',
    title: 'Scan Completed',
    description: '38 packages mapped across 142 AST nodes in repository.',
    badge: 'Success',
    badgeColor: 'text-[#15803D]',
  },
  {
    id: 'log-2',
    timestamp: '14:31:45 UTC',
    type: 'migration',
    title: 'Gemma 4 Migration',
    description: 'Generated migration proposal for urlwatch → httpx-resilience.',
    badge: 'Gemma 4',
    badgeColor: 'text-primary',
  },
  {
    id: 'log-3',
    timestamp: '14:30:12 UTC',
    type: 'test',
    title: 'Test Runner Pass',
    description: 'Executed 18 unit tests on isolated Python 3.12 container runtime.',
    badge: '18/18 Passed',
    badgeColor: 'text-[#15803D]',
  },
  {
    id: 'log-4',
    timestamp: '14:28:00 UTC',
    type: 'capsule',
    title: 'Capsule Created',
    description: 'Dependency Exit Capsule compiled: #CAP-2026-LW01.',
    badge: 'Capsule',
    badgeColor: 'text-secondary',
  },
  {
    id: 'log-5',
    timestamp: '14:25:30 UTC',
    type: 'manifest',
    title: 'Manifests Parsed',
    description: 'Parsed pyproject.toml and requirements.txt successfully.',
    badge: 'Manifest',
    badgeColor: 'text-secondary',
  },
];

export const SCANNER_PIPELINE_STAGES: InspectionStage[] = [
  {
    id: 's1',
    stageNumber: 'STAGE 01',
    name: 'Repository Access',
    detail: 'Cloned depth=1 (64ms)',
    status: 'completed',
    latency: '64ms',
  },
  {
    id: 's2',
    stageNumber: 'STAGE 02',
    name: 'Manifest Discovery',
    detail: 'requirements.txt, toml',
    status: 'completed',
    latency: '112ms',
  },
  {
    id: 's3',
    stageNumber: 'STAGE 03',
    name: 'Dependency Inventory',
    detail: '38 mapped packages',
    status: 'completed',
    latency: '180ms',
  },
  {
    id: 's4',
    stageNumber: 'STAGE 04',
    name: 'AST Usage Mapping',
    detail: '47 .py files, 142 sites',
    status: 'completed',
    latency: '640ms',
  },
  {
    id: 's5',
    stageNumber: 'STAGE 05',
    name: 'Risk Assessment',
    detail: 'Maintenance & PyPI',
    status: 'completed',
    latency: '410ms',
  },
  {
    id: 's6',
    stageNumber: 'STAGE 06',
    name: 'Report Generation',
    detail: 'Ready for Gemma 4',
    status: 'active',
    latency: '820ms',
  },
];
