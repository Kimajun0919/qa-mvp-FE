CREATE TABLE IF NOT EXISTS runs (
  runId TEXT PRIMARY KEY,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runId TEXT NOT NULL,
  executedAt TEXT NOT NULL,
  screen TEXT NOT NULL,
  testId TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  url TEXT,
  path TEXT,
  category TEXT,
  expected TEXT,
  actual TEXT,
  screenshotPath TEXT,
  htmlPath TEXT,
  tracePath TEXT,
  consoleErrorsCount INTEGER,
  networkSummary TEXT,
  fingerprint TEXT,
  FOREIGN KEY (runId) REFERENCES runs(runId)
);

CREATE TABLE IF NOT EXISTS issues (
  fingerprint TEXT PRIMARY KEY,
  firstSeenAt TEXT NOT NULL,
  lastSeenAt TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  lastRunId TEXT NOT NULL
);
