import express from 'express';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { discoverSite } from '../discovery/crawler.js';
import { writeAnalysisReports } from '../discovery/reports.js';
import { planFlowsFromDiscovery } from '../llm/planner.js';
import { judgeRun } from '../llm/judge.js';
import { checklistToTsv, generateQAChecklist } from '../llm/checklist.js';
import { writeStaticReport } from '../dashboard/static_report.js';
import { ResultStore, type FlowDefinitionInput } from '../store/sqlite.js';

type RoleInput = {
  role: 'admin' | 'user';
  pagePath: string;
  id: string;
  pw: string;
};

type RunInput = {
  baseUrl: string;
  loginPath: string;
  loginIdTestId: string;
  loginPwTestId: string;
  loginSubmitTestId: string;
  adminPageTestId?: string;
  userPageTestId?: string;
  adminId: string;
  adminPw: string;
  adminPath: string;
  userId: string;
  userPw: string;
  userPath: string;
  headless?: boolean;
};

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const origin = String(req.headers.origin || '');
  const configured = String(process.env.QA_WEB_ORIGIN || '*').trim();
  const allowOrigin = configured === '*' ? '*' : configured;
  if (allowOrigin === '*' || (origin && origin === allowOrigin)) {
    res.header('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static('public'));
app.use('/out', express.static('out'));

const memAnalysis = new Map<string, { baseUrl: string; discovered: any; flows: any[] }>();

function tryStore() {
  try {
    const s = new ResultStore();
    s.migrate();
    return s;
  } catch {
    return null;
  }
}

app.post('/api/analyze', async (req, res) => {
  const baseUrl = String(req.body?.baseUrl ?? '');
  const llmProvider = req.body?.llmProvider as 'openai' | 'ollama' | undefined;
  const llmModel = String(req.body?.llmModel ?? '').trim() || undefined;
  if (!baseUrl) return res.status(400).json({ ok: false, error: 'baseUrl required' });

  try {
    const result = await discoverSite(baseUrl, { maxPages: 50, maxDepth: 3 });
    const analysisId = `analysis_${Date.now()}`;
    const store = tryStore();
    if (store) {
      store.saveDiscovery(analysisId, result);
    }
    const planned = await planFlowsFromDiscovery(result, { provider: llmProvider, model: llmModel });
    if (store) {
      store.saveFlowCandidates(analysisId, planned.candidates);
    }
    memAnalysis.set(analysisId, { baseUrl, discovered: result, flows: [] });

    const analysisReports = writeAnalysisReports(analysisId, result);

    res.json({
      ok: true,
      analysisId,
      pages: result.pages.length,
      elements: result.elements.length,
      serviceType: result.serviceType,
      authLikely: result.authLikely,
      limits: result.limits,
      plannerMode: planned.mode,
      plannerReason: planned.reason ?? '',
      metrics: result.metrics,
      reports: {
        sitemapPath: analysisReports.sitemapPath,
        menuPath: analysisReports.menuPath,
        qualityPath: analysisReports.qualityPath,
      },
      candidates: planned.candidates,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'analysis failed' });
  }
});

app.get('/api/analysis/:analysisId', (req, res) => {
  const analysisId = req.params.analysisId;
  const store = tryStore();
  if (store) {
    const data = store.getAnalysisBundle(analysisId);
    if (data.analysis) return res.json({ ok: true, ...data, storage: 'sqlite' });
  }

  const mem = memAnalysis.get(analysisId);
  if (!mem) return res.status(404).json({ ok: false, error: 'analysis not found' });
  res.json({ ok: true, storage: 'memory', analysis: { analysisId, baseUrl: mem.baseUrl }, pages: mem.discovered.pages, elements: mem.discovered.elements, candidates: [] });
});

app.post('/api/checklist', async (req, res) => {
  const screen = String(req.body?.screen ?? '').trim();
  const context = String(req.body?.context ?? '').trim();
  const includeAuth = Boolean(req.body?.includeAuth);
  const llmProvider = req.body?.llmProvider as 'openai' | 'ollama' | undefined;
  const llmModel = String(req.body?.llmModel ?? '').trim() || undefined;
  if (!screen) return res.status(400).json({ ok: false, error: 'screen required' });

  const out = await generateQAChecklist({ screen, context, includeAuth }, { provider: llmProvider, model: llmModel });
  const tsv = checklistToTsv(out.rows);
  res.json({ ok: true, mode: out.mode, reason: out.reason ?? '', columns: ['화면', '구분', '테스트시나리오', '확인'], rows: out.rows, tsv });
});

app.post('/api/oneclick', async (req, res) => {
  const baseUrl = String(req.body?.baseUrl ?? '');
  const llmProvider = req.body?.llmProvider as 'openai' | 'ollama' | undefined;
  const llmModel = String(req.body?.llmModel ?? '').trim() || undefined;
  if (!baseUrl) return res.status(400).json({ ok: false, error: 'baseUrl required' });

  try {
    const discovered = await discoverSite(baseUrl, { maxPages: 50, maxDepth: 3 });
    const analysisId = `analysis_${Date.now()}`;
    const store = tryStore();
    if (store) store.saveDiscovery(analysisId, discovered);

    const planned = await planFlowsFromDiscovery(discovered, { provider: llmProvider, model: llmModel });
    const candidates = planned.candidates;
    if (store) store.saveFlowCandidates(analysisId, candidates);

    const analysisReports = writeAnalysisReports(analysisId, discovered);

    const autoFlows = candidates.map((c) => ({
      name: c.name,
      loginMode: discovered.authLikely ? 'OPTIONAL' : 'OFF',
      steps: [
        { action: 'NAVIGATE', targetUrl: '/' },
        { action: 'ASSERT_URL', targetUrl: '/' },
      ],
    })) as FlowDefinitionInput[];

    if (store) store.saveFinalFlows(analysisId, autoFlows);
    memAnalysis.set(analysisId, { baseUrl, discovered, flows: autoFlows as any[] });

    const flows = store ? store.getFinalFlows(analysisId).flows : (autoFlows as any[]);
    const runId = `pmrun_${Date.now()}`;
    const report = await runFinalizedFlows(baseUrl, flows, runId);
    const judge = await judgeRun(
      {
        finalStatus: report.execution.finalStatus,
        summary: report.summary,
        issues: report.failed,
        network: report.network,
        console: report.console,
      },
      { provider: llmProvider, model: llmModel },
    );
    const withJudge = { ...report, judge };
    writeStaticReport(withJudge);
    writeFileSync(path.join('out', 'report', `run_${runId}.json`), JSON.stringify(withJudge, null, 2), 'utf-8');

    res.json({
      ok: true,
      oneClick: true,
      analysisId,
      runId,
      finalStatus: report.execution.finalStatus,
      summary: report.summary,
      judge,
      reportPath: 'out/report/index.html',
      reportJson: `out/report/run_${runId}.json`,
      discovered: {
        pages: discovered.pages.length,
        elements: discovered.elements.length,
        serviceType: discovered.serviceType,
        authLikely: discovered.authLikely,
        metrics: discovered.metrics,
      },
      plannerMode: planned.mode,
      plannerReason: planned.reason ?? '',
      analysisReports: {
        sitemapPath: analysisReports.sitemapPath,
        menuPath: analysisReports.menuPath,
        qualityPath: analysisReports.qualityPath,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'oneclick failed' });
  }
});

app.post('/api/flows/finalize', (req, res) => {
  const analysisId = String(req.body?.analysisId ?? '');
  const flows = (req.body?.flows ?? []) as FlowDefinitionInput[];
  if (!analysisId) return res.status(400).json({ ok: false, error: 'analysisId required' });
  if (!Array.isArray(flows) || flows.length === 0) return res.status(400).json({ ok: false, error: 'flows required' });

  const store = tryStore();
  if (store) store.saveFinalFlows(analysisId, flows);

  const mem = memAnalysis.get(analysisId);
  if (mem) mem.flows = flows;

  res.json({ ok: true, saved: flows.length, storage: store ? 'sqlite' : 'memory' });
});

app.post('/api/flows/run', async (req, res) => {
  const analysisId = String(req.body?.analysisId ?? '');
  const llmProvider = req.body?.llmProvider as 'openai' | 'ollama' | undefined;
  const llmModel = String(req.body?.llmModel ?? '').trim() || undefined;
  if (!analysisId) return res.status(400).json({ ok: false, error: 'analysisId required' });

  const store = tryStore();
  let baseUrl = '';
  let flows: any[] = [];

  if (store) {
    const bundle = store.getFinalFlows(analysisId);
    if (bundle.analysis) {
      baseUrl = bundle.analysis.baseUrl;
      flows = bundle.flows;
    }
  }

  if (!baseUrl) {
    const mem = memAnalysis.get(analysisId);
    if (mem) {
      baseUrl = mem.baseUrl;
      flows = mem.flows || [];
    }
  }

  if (!baseUrl) return res.status(404).json({ ok: false, error: 'analysis not found' });
  if (!flows || flows.length === 0) return res.status(400).json({ ok: false, error: 'no finalized flows' });

  try {
    const runId = `pmrun_${Date.now()}`;
    const report = await runFinalizedFlows(baseUrl, flows, runId);
    const judge = await judgeRun(
      {
        finalStatus: report.execution.finalStatus,
        summary: report.summary,
        issues: report.failed,
        network: report.network,
        console: report.console,
      },
      { provider: llmProvider, model: llmModel },
    );
    const withJudge = { ...report, judge };
    writeStaticReport(withJudge);
    writeFileSync(path.join('out', 'report', `run_${runId}.json`), JSON.stringify(withJudge, null, 2), 'utf-8');
    res.json({
      ok: true,
      runId,
      finalStatus: report.execution.finalStatus,
      summary: report.summary,
      flowSummary: report.flowSummary,
      judge,
      reportPath: 'out/report/index.html',
      reportJson: `out/report/run_${runId}.json`,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'flow run failed' });
  }
});

app.post('/api/run', async (req, res) => {
  const body = req.body as RunInput;
  const runId = `quick_${Date.now()}`;
  mkdirSync(path.join('out', 'web_runs', runId), { recursive: true });

  try {
    const results = await runQuickQA(body, runId);
    writeFileSync(path.join('out', 'web_runs', runId, 'result.json'), JSON.stringify(results, null, 2), 'utf-8');
    res.json({ ok: true, runId, results, reportPath: `out/web_runs/${runId}/result.json` });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'unknown error' });
  }
});

function calcFinalStatus(summary: { PASS: number; WARNING: number; FAIL: number; BLOCKED: number; ERROR: number }) {
  if (summary.FAIL > 0) return 'FAIL' as const;
  if (summary.ERROR > 0) return 'FAIL' as const;
  if (summary.BLOCKED > 0) return 'FAIL' as const;
  if (summary.WARNING > 0) return 'PASS_WITH_WARNINGS' as const;
  return 'PASS' as const;
}

async function runFinalizedFlows(baseUrl: string, flows: any[], runId: string) {
  const startedAt = new Date();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const network4xx: string[] = [];
  const network5xx: string[] = [];
  const failedReq: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400 && s < 500) network4xx.push(`${s} ${res.url()}`);
    if (s >= 500) network5xx.push(`${s} ${res.url()}`);
  });
  page.on('requestfailed', (req) => failedReq.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`));

  const allIssues: any[] = [];
  const flowSummary: Array<{ flowName: string; durationMs: number; status: string; issueCount: number }> = [];

  for (const flow of flows) {
    const flowStart = Date.now();
    let flowStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' = 'PASS';
    let issueCount = 0;

    for (const step of flow.steps as any[]) {
      const executedAt = new Date().toISOString();
      try {
        if (step.action === 'NAVIGATE') {
          const to = step.targetUrl ? new URL(step.targetUrl, baseUrl).toString() : baseUrl;
          await page.goto(to, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } else if (step.action === 'ASSERT_URL') {
          const target = step.targetUrl ?? '/';
          const ok = page.url().includes(target);
          if (!ok) {
            flowStatus = 'FAIL';
            issueCount++;
            const shot = path.join('artifacts', runId, `${flow.flowId}_assert_url.png`);
            mkdirSync(path.dirname(shot), { recursive: true });
            await page.screenshot({ path: shot, fullPage: true });
            allIssues.push({
              status: 'FAIL',
              actual: `expected url includes ${target} but got ${page.url()}`,
              screenshotPath: shot,
              networkSummary: failedReq.slice(-5).join('\n'),
              executedAt,
            });
          }
        } else if (step.action === 'CLICK' && step.selector) {
          await page.locator(step.selector).first().click();
        } else if (step.action === 'TYPE' && step.selector) {
          await page.locator(step.selector).first().fill(step.value ?? '');
        } else if (step.action === 'ASSERT_VISIBLE' && step.selector) {
          const ok = await page.locator(step.selector).first().isVisible();
          if (!ok) {
            flowStatus = 'FAIL';
            issueCount++;
            const shot = path.join('artifacts', runId, `${flow.flowId}_assert_visible.png`);
            mkdirSync(path.dirname(shot), { recursive: true });
            await page.screenshot({ path: shot, fullPage: true });
            allIssues.push({
              status: 'FAIL',
              actual: `selector not visible: ${step.selector}`,
              screenshotPath: shot,
              networkSummary: failedReq.slice(-5).join('\n'),
              executedAt,
            });
          }
        } else if (step.action === 'WAIT') {
          await page.waitForTimeout(Number(step.value ?? 500));
        }
      } catch (e: any) {
        flowStatus = 'FAIL';
        issueCount++;
        const shot = path.join('artifacts', runId, `${flow.flowId}_error.png`);
        mkdirSync(path.dirname(shot), { recursive: true });
        await page.screenshot({ path: shot, fullPage: true });
        allIssues.push({
          status: 'ERROR',
          actual: e?.message ?? 'step error',
          screenshotPath: shot,
          networkSummary: failedReq.slice(-5).join('\n'),
          executedAt,
        });
      }
    }

    if (flowStatus !== 'FAIL' && consoleWarnings.length > 0) {
      flowStatus = 'PASS_WITH_WARNINGS';
    }

    flowSummary.push({
      flowName: flow.name,
      durationMs: Date.now() - flowStart,
      status: flowStatus,
      issueCount,
    });
  }

  await context.close();
  await browser.close();

  const summary = {
    PASS: flowSummary.filter((f) => f.status === 'PASS').length,
    WARNING: flowSummary.filter((f) => f.status === 'PASS_WITH_WARNINGS').length,
    FAIL: flowSummary.filter((f) => f.status === 'FAIL').length,
    BLOCKED: 0,
    ERROR: allIssues.filter((i) => i.status === 'ERROR').length,
    FINAL: 'PASS',
  };
  const final = calcFinalStatus(summary);
  summary.FINAL = final;

  const endedAt = new Date();
  return {
    runId,
    summary,
    failed: allIssues,
    execution: {
      targetUrl: baseUrl,
      startedAt: startedAt.toISOString(),
      finishedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      finalStatus: final,
    },
    flowSummary,
    network: {
      total4xx: network4xx.length,
      total5xx: network5xx.length,
      failedUrls: [...new Set([...network4xx, ...network5xx, ...failedReq])].slice(0, 50),
    },
    console: {
      errorCount: consoleErrors.length,
      warningCount: consoleWarnings.length,
      top5: [...consoleErrors, ...consoleWarnings].slice(0, 5),
    },
    artifacts: {
      htmlReportPath: 'out/report/index.html',
      csvPath: '',
      screenshotDir: `artifacts/${runId}`,
    },
  };
}

async function runQuickQA(input: RunInput, runId: string) {
  const browser = await chromium.launch({ headless: input.headless ?? true });
  const roles: RoleInput[] = [
    { role: 'admin', pagePath: input.adminPath, id: input.adminId, pw: input.adminPw },
    { role: 'user', pagePath: input.userPath, id: input.userId, pw: input.userPw },
  ];

  const out: any[] = [];

  for (const role of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const stepArtifacts = path.join('out', 'web_runs', runId, `${role.role}.png`);

    let status: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS';
    let actual = 'ok';

    try {
      await page.goto(`${input.baseUrl}${input.loginPath}`);

      // data-testid policy enforced
      if (!input.loginIdTestId || !input.loginPwTestId || !input.loginSubmitTestId) {
        status = 'BLOCKED';
        actual = '로그인 data-testid 누락';
      } else {
        await page.getByTestId(input.loginIdTestId).fill(role.id);
        await page.getByTestId(input.loginPwTestId).fill(role.pw);
        await page.getByTestId(input.loginSubmitTestId).click();

        await page.goto(`${input.baseUrl}${role.pagePath}`);

        const mustTestId = role.role === 'admin' ? input.adminPageTestId : input.userPageTestId;
        if (!mustTestId) {
          status = 'BLOCKED';
          actual = `${role.role} 페이지 검증용 data-testid 누락`;
        } else {
          const loc = page.getByTestId(mustTestId);
          const count = await loc.count();
          if (count === 0 || !(await loc.first().isVisible())) {
            status = 'FAIL';
            actual = `${mustTestId} not visible`;
          }
        }
      }
    } catch (e: any) {
      status = 'FAIL';
      actual = e?.message ?? 'run error';
    }

    await page.screenshot({ path: stepArtifacts, fullPage: true });
    out.push({ role: role.role, status, actual, screenshot: stepArtifacts, url: page.url() });
    await context.close();
  }

  await browser.close();
  return out;
}

const port = Number(process.env.PORT ?? 4173);
app.listen(port, () => {
  console.log(`QA quick web running: http://localhost:${port}`);
});
