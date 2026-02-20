import { mkdirSync, writeFileSync } from 'node:fs';

function esc(s: unknown) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function issueTypeOf(r: any) {
  const msg = `${r.actual ?? ''}\n${r.networkSummary ?? ''}`.toLowerCase();
  if (/timeout|timed out/.test(msg)) return 'Timeout';
  if (/selector|testid|not found|visible/.test(msg)) return 'Selector';
  if (/http|4\d\d|5\d\d/.test(msg)) return 'HTTP';
  if (/requestfailed|resource|err_/.test(msg)) return 'Resource';
  if ((r.status ?? '') === 'ERROR') return 'JS';
  return 'JS';
}

function issueSeverityOf(r: any) {
  return r.status === 'WARNING' ? 'WARNING' : 'CRITICAL';
}

export function writeStaticReport(payload: {
  runId: string;
  summary: Record<string, number | string>;
  failed: any[];
  execution: {
    targetUrl: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    finalStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  };
  flowSummary: Array<{ flowName: string; durationMs: number; status: string; issueCount: number }>;
  network: { total4xx: number; total5xx: number; failedUrls: string[] };
  console: { errorCount: number; warningCount: number; top5: string[] };
  artifacts: { htmlReportPath: string; csvPath: string; screenshotDir: string };
  judge?: { mode: string; topCause: string; priority: string; summary3Lines: string[]; reason?: string };
}) {
  mkdirSync('out/report', { recursive: true });

  const flowRows = payload.flowSummary
    .map(
      (f) =>
        `<tr><td>${esc(f.flowName)}</td><td>${Math.round(f.durationMs / 1000)}s</td><td>${esc(f.status)}</td><td>${f.issueCount}</td></tr>`,
    )
    .join('');

  const issueRows = payload.failed
    .map((r) => {
      const screenshot = r.screenshotPath ? `<a href="../${esc(r.screenshotPath)}" target="_blank">open</a>` : '';
      const consoleExcerpt = esc((r.actual ?? '').toString().slice(0, 240));
      return `<tr>
        <td>${issueSeverityOf(r)}</td>
        <td>${issueTypeOf(r)}</td>
        <td>${esc(r.actual)}</td>
        <td>${screenshot}</td>
        <td><code>${consoleExcerpt}</code></td>
      </tr>`;
    })
    .join('');

  const failedUrls = payload.network.failedUrls.map((u) => `<li><code>${esc(u)}</code></li>`).join('');
  const top5Logs = payload.console.top5.map((l) => `<li><code>${esc(l)}</code></li>`).join('');

  const html = `<!doctype html><html><head><meta charset='utf-8'><title>QA Report</title>
  <style>body{font-family:Inter,system-ui,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}h2{margin-top:28px}code{font-size:12px}</style>
  </head><body>
  <h1>QA Run ${esc(payload.runId)}</h1>

  <h2>1. Execution Summary</h2>
  <ul>
    <li>Target URL: <b>${esc(payload.execution.targetUrl)}</b></li>
    <li>Started: ${esc(payload.execution.startedAt)}</li>
    <li>Finished: ${esc(payload.execution.finishedAt)}</li>
    <li>Total Duration: <b>${Math.round(payload.execution.durationMs / 1000)}s</b></li>
    <li>Final Status: <b>${esc(payload.execution.finalStatus)}</b></li>
  </ul>

  <h2>2. Flow Summary</h2>
  <table><thead><tr><th>Flow Name</th><th>Duration</th><th>Status</th><th>Issue Count</th></tr></thead><tbody>${flowRows}</tbody></table>

  <h2>3. Issues Detail</h2>
  <table><thead><tr><th>Severity</th><th>Type</th><th>Message</th><th>Screenshot</th><th>Console excerpt</th></tr></thead><tbody>${issueRows}</tbody></table>

  <h2>4. Network Summary</h2>
  <ul>
    <li>4xx count: <b>${payload.network.total4xx}</b></li>
    <li>5xx count: <b>${payload.network.total5xx}</b></li>
  </ul>
  <ol>${failedUrls}</ol>

  <h2>5. Console Summary</h2>
  <ul>
    <li>console.error count: <b>${payload.console.errorCount}</b></li>
    <li>console.warning count: <b>${payload.console.warningCount}</b></li>
  </ul>
  <ol>${top5Logs}</ol>

  <h2>6. Artifacts</h2>
  <ul>
    <li>HTML report path: <code>${esc(payload.artifacts.htmlReportPath)}</code></li>
    <li>CSV path: <code>${esc(payload.artifacts.csvPath || '(none)')}</code></li>
    <li>Screenshot dir: <code>${esc(payload.artifacts.screenshotDir)}</code></li>
  </ul>

  <h2>7. LLM Judgment</h2>
  <ul>
    <li>Mode: <b>${esc(payload.judge?.mode ?? 'n/a')}</b></li>
    <li>Top Cause: <b>${esc(payload.judge?.topCause ?? 'Unknown')}</b></li>
    <li>Priority: <b>${esc(payload.judge?.priority ?? 'P3')}</b></li>
  </ul>
  <ol>
    <li>${esc(payload.judge?.summary3Lines?.[0] ?? '')}</li>
    <li>${esc(payload.judge?.summary3Lines?.[1] ?? '')}</li>
    <li>${esc(payload.judge?.summary3Lines?.[2] ?? '')}</li>
  </ol>

  <h3>Raw Summary</h3>
  <pre>${esc(JSON.stringify(payload.summary, null, 2))}</pre>
  </body></html>`;

  writeFileSync('out/report/index.html', html, 'utf-8');
}
