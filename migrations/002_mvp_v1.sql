-- MVP v1 normalized schema extensions

CREATE TABLE IF NOT EXISTS analysis_runs (
  analysisId TEXT PRIMARY KEY,
  baseUrl TEXT NOT NULL,
  origin TEXT NOT NULL,
  maxPages INTEGER NOT NULL DEFAULT 50,
  maxDepth INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  finishedAt TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysisId TEXT NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL,
  httpStatus INTEGER,
  title TEXT,
  isAuthLikely INTEGER NOT NULL DEFAULT 0,
  UNIQUE(analysisId, url),
  FOREIGN KEY (analysisId) REFERENCES analysis_runs(analysisId)
);

CREATE TABLE IF NOT EXISTS elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysisId TEXT NOT NULL,
  pageId INTEGER,
  kind TEXT NOT NULL,
  selector TEXT,
  text TEXT,
  href TEXT,
  FOREIGN KEY (analysisId) REFERENCES analysis_runs(analysisId),
  FOREIGN KEY (pageId) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS flow_candidates (
  id TEXT PRIMARY KEY,
  analysisId TEXT NOT NULL,
  name TEXT NOT NULL,
  platformType TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  source TEXT NOT NULL DEFAULT 'AUTO',
  FOREIGN KEY (analysisId) REFERENCES analysis_runs(analysisId)
);

CREATE TABLE IF NOT EXISTS flow_definitions (
  flowId TEXT PRIMARY KEY,
  analysisId TEXT NOT NULL,
  name TEXT NOT NULL,
  loginMode TEXT NOT NULL DEFAULT 'OFF',
  createdBy TEXT NOT NULL DEFAULT 'AUTO',
  isFinal INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (analysisId) REFERENCES analysis_runs(analysisId)
);

CREATE TABLE IF NOT EXISTS flow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flowId TEXT NOT NULL,
  stepOrder INTEGER NOT NULL,
  action TEXT NOT NULL,
  selector TEXT,
  value TEXT,
  targetUrl TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (flowId) REFERENCES flow_definitions(flowId)
);

CREATE TABLE IF NOT EXISTS run_executions (
  runId TEXT PRIMARY KEY,
  flowId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  result TEXT,
  criticalCount INTEGER NOT NULL DEFAULT 0,
  warningCount INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (flowId) REFERENCES flow_definitions(flowId)
);

CREATE TABLE IF NOT EXISTS step_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runId TEXT NOT NULL,
  stepId INTEGER,
  executedAt TEXT NOT NULL,
  status TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT,
  screenshotPath TEXT,
  consoleLogPath TEXT,
  networkLogPath TEXT,
  FOREIGN KEY (runId) REFERENCES run_executions(runId),
  FOREIGN KEY (stepId) REFERENCES flow_steps(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runId TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (runId) REFERENCES run_executions(runId)
);

CREATE INDEX IF NOT EXISTS idx_pages_analysis_depth ON pages(analysisId, depth);
CREATE INDEX IF NOT EXISTS idx_pages_analysis_path ON pages(analysisId, path);
CREATE INDEX IF NOT EXISTS idx_elements_analysis_kind ON elements(analysisId, kind);
CREATE INDEX IF NOT EXISTS idx_flow_candidates_analysis_status ON flow_candidates(analysisId, status);
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow_order ON flow_steps(flowId, stepOrder);
CREATE INDEX IF NOT EXISTS idx_step_results_run_level_status ON step_results(runId, level, status);
