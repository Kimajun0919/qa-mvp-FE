import { readFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync, appendFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadDSLTests } from './dsl/parser.js';
import { runSuite } from './runner/playwright.js';
import { ResultStore } from './store/sqlite.js';
import { generateFixSheet } from './report/fix_sheet.js';
import { writeStaticReport } from './dashboard/static_report.js';
import type { QAConfig } from './types.js';

export async function executeOnce() {
  mkdirSync('logs', { recursive: true });
  const lockPath = 'out/run.lock';
  if (existsSync(lockPath)) {
    appendFileSync('logs/runner.log', `${new Date().toISOString()} skip: lock exists\n`);
    return { skipped: true };
  }
  writeFileSync(lockPath, String(process.pid));

  const config = JSON.parse(readFileSync('qa.config.json', 'utf-8')) as QAConfig;
  const runId = `run_${Date.now()}`;
  const store = new ResultStore();
  store.migrate();
  store.createRun(runId, new Date().toISOString());

  try {
    const dsl = await loadDSLTests('tests');
    const startedAt = new Date();
    let suite = await runSuite(config, dsl, runId);
    let results = suite.results;

    const retryable = results.filter((r) => r.status === 'ERROR' && /net|timeout|ECONN|ERR_/i.test(r.actual));
    if (retryable.length > 0) {
      appendFileSync('logs/runner.log', `${new Date().toISOString()} retry once for transient network errors\n`);
      suite = await runSuite(config, dsl, runId);
      results = suite.results;
    }

    for (const r of results) store.insertResult(r);
    const failRows = store.failedResultsByRun(runId);
    const issueRows = results.filter((r) => r.status !== 'PASS');
    const outBase = path.join('out', `fix_requests_${new Date().toISOString().slice(0, 10)}_${runId}`);
    if (failRows.length > 0) generateFixSheet(failRows, outBase);

    const summary = {
      PASS: results.filter((r) => r.status === 'PASS').length,
      WARNING: results.filter((r) => r.status === 'WARNING').length,
      FAIL: results.filter((r) => r.status === 'FAIL').length,
      BLOCKED: results.filter((r) => r.status === 'BLOCKED').length,
      ERROR: results.filter((r) => r.status === 'ERROR').length,
    };
    const finalStatus = computeFinalStatus(summary);
    const reportSummary = { ...summary, FINAL: finalStatus };

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const flowSummary = buildFlowSummary(results);

    store.finishRun(runId, endedAt.toISOString(), JSON.stringify(reportSummary));
    writeStaticReport({
      runId,
      summary: reportSummary,
      failed: issueRows,
      execution: {
        targetUrl: config.baseUrl,
        startedAt: startedAt.toISOString(),
        finishedAt: endedAt.toISOString(),
        durationMs,
        finalStatus,
      },
      flowSummary,
      network: {
        total4xx: suite.diagnostics.network4xxCount,
        total5xx: suite.diagnostics.network5xxCount,
        failedUrls: suite.diagnostics.failedRequestUrls,
      },
      console: {
        errorCount: suite.diagnostics.consoleErrorCount,
        warningCount: suite.diagnostics.consoleWarningCount,
        top5: suite.diagnostics.consoleTop5,
      },
      artifacts: {
        htmlReportPath: 'out/report/index.html',
        csvPath: failRows.length > 0 ? `${outBase}.csv` : '',
        screenshotDir: `artifacts/${runId}`,
      },
    });
    appendFileSync('logs/runner.log', `${new Date().toISOString()} runId=${runId} ${JSON.stringify(reportSummary)}\n`);

    cleanupOldArtifacts(config.retentionDays);
    return { runId, summary: reportSummary, outBase, failCount: failRows.length, finalStatus };
  } finally {
    unlinkSync(lockPath);
  }
}

function buildFlowSummary(results: Array<{ screen: string; status: string; durationMs?: number }>) {
  const m = new Map<string, { durationMs: number; issueCount: number; status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' }>();
  for (const r of results) {
    if (!m.has(r.screen)) m.set(r.screen, { durationMs: 0, issueCount: 0, status: 'PASS' });
    const row = m.get(r.screen)!;
    row.durationMs += r.durationMs ?? 0;
    if (r.status !== 'PASS') row.issueCount += 1;
    if (r.status === 'FAIL' || r.status === 'ERROR' || r.status === 'BLOCKED') row.status = 'FAIL';
    else if (row.status !== 'FAIL' && r.status === 'WARNING') row.status = 'PASS_WITH_WARNINGS';
  }
  return [...m.entries()].map(([flowName, v]) => ({ flowName, ...v }));
}

function computeFinalStatus(summary: { PASS: number; WARNING: number; FAIL: number; BLOCKED: number; ERROR: number }) {
  if (summary.FAIL > 0) return 'FAIL';
  if (summary.ERROR > 0) return 'FAIL';
  if (summary.BLOCKED > 0) return 'FAIL';
  if (summary.WARNING > 0) return 'PASS_WITH_WARNINGS';
  return 'PASS';
}

function cleanupOldArtifacts(retentionDays: number) {
  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const dir of ['artifacts', 'out']) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const p = path.join(dir, file);
      const st = statSync(p);
      if (st.mtimeMs < threshold && file !== 'qa.sqlite') rmSync(p, { recursive: true, force: true });
    }
  }
}
