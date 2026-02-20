import { chromium } from 'playwright';
import type { DSLScreen, QAConfig, TestResult } from '../types.js';
import { runExpectation } from './assertions.js';
import { saveArtifacts } from './artifacts.js';

function fp(screen: string, testId: string, actual: string) {
  return `${screen}::${testId}::${actual.slice(0, 120)}`;
}

export type RunDiagnostics = {
  consoleErrorCount: number;
  consoleWarningCount: number;
  consoleTop5: string[];
  network4xxCount: number;
  network5xxCount: number;
  failedRequestUrls: string[];
};

export async function runSuite(config: QAConfig, dsl: DSLScreen[], runId: string): Promise<{ results: TestResult[]; diagnostics: RunDiagnostics }> {
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results: TestResult[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const failedRequests: string[] = [];
  const network4xx: string[] = [];
  const network5xx: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400 && s < 500) network4xx.push(`${s} ${res.url()}`);
    if (s >= 500) network5xx.push(`${s} ${res.url()}`);
  });

  if (config.requireLogin) {
    const id = config.login ? process.env[config.login.idEnv] : '';
    const pw = config.login ? process.env[config.login.pwEnv] : '';
    if (!id || !pw || !config.login) {
      for (const screen of dsl) {
        for (const t of screen.tests) {
          const executedAt = new Date().toISOString();
          results.push({
            runId,
            executedAt,
            screen: screen.screen,
            testId: t.id,
            status: 'BLOCKED',
            expected: '로그인 후 테스트 수행',
            actual: 'QA_LOGIN_ID/QA_LOGIN_PW 미설정',
            url: config.baseUrl,
            path: screen.path,
            category: t.category,
            severity: t.severity,
            consoleErrorsCount: 0,
            networkSummary: '',
            fingerprint: fp(screen.screen, t.id, 'missing-login-env'),
          });
        }
      }
      await browser.close();
      return {
        results,
        diagnostics: {
          consoleErrorCount: consoleErrors.length,
          consoleWarningCount: consoleWarnings.length,
          consoleTop5: [...consoleErrors, ...consoleWarnings].slice(0, 5),
          network4xxCount: network4xx.length,
          network5xxCount: network5xx.length,
          failedRequestUrls: failedRequests.slice(0, 20),
        },
      };
    }
    await page.goto(`${config.baseUrl}${config.login.path}`);
    await page.getByTestId(config.login.idTestId).fill(id);
    await page.getByTestId(config.login.pwTestId).fill(pw);
    await page.getByTestId(config.login.submitTestId).click();
  }

  for (const screen of dsl) {
    for (const t of screen.tests) {
      const executedAt = new Date().toISOString();
      const testStarted = Date.now();
      const warnBase = consoleWarnings.length;
      const errBase = consoleErrors.length;
      const failedReqBase = failedRequests.length;
      try {
        for (const step of t.steps) {
          if (step.goto) await page.goto(`${config.baseUrl}${step.goto}`);
          if (step.click) await page.getByTestId(step.click).click();
          if (step.fill) {
            if (!step.fill.testid) throw new Error('data-testid 누락');
            await page.getByTestId(step.fill.testid).fill(step.fill.value ?? '');
          }
        }

        const check = await runExpectation(page, t.expect);
        let status: TestResult['status'] = check.ok ? 'PASS' : check.blocked ? 'BLOCKED' : 'FAIL';
        const warningDelta = consoleWarnings.length - warnBase;
        const errorDelta = consoleErrors.length - errBase;
        const failedReqDelta = failedRequests.length - failedReqBase;
        if (status === 'PASS' && warningDelta > 0) status = 'WARNING';
        if (status === 'PASS' && failedReqDelta > 0) status = 'WARNING';
        if (status === 'PASS' && errorDelta > 0) status = 'ERROR';
        let screenshotPath: string | undefined;
        let htmlPath: string | undefined;
        if (status !== 'PASS') {
          const artifacts = await saveArtifacts(page, runId, t.id);
          screenshotPath = artifacts.screenshotPath;
          htmlPath = artifacts.htmlPath;
        }
        results.push({
          runId,
          executedAt,
          screen: screen.screen,
          testId: t.id,
          status,
          expected: check.expected,
          actual: check.actual,
          url: page.url(),
          path: screen.path,
          category: t.category,
          severity: t.severity,
          screenshotPath,
          htmlPath,
          consoleErrorsCount: consoleErrors.length,
          consoleWarningsCount: consoleWarnings.length,
          networkSummary: failedRequests.slice(Math.max(0, failedReqBase)).slice(-5).join('\n'),
          durationMs: Date.now() - testStarted,
          fingerprint: fp(screen.screen, t.id, check.actual),
        });
      } catch (e: any) {
        const artifacts = await saveArtifacts(page, runId, t.id);
        results.push({
          runId,
          executedAt,
          screen: screen.screen,
          testId: t.id,
          status: String(e?.message || '').includes('data-testid') ? 'BLOCKED' : 'ERROR',
          expected: 'step/expect complete',
          actual: e?.message ?? 'unknown error',
          url: page.url(),
          path: screen.path,
          category: t.category,
          severity: t.severity,
          screenshotPath: artifacts.screenshotPath,
          htmlPath: artifacts.htmlPath,
          consoleErrorsCount: consoleErrors.length,
          consoleWarningsCount: consoleWarnings.length,
          networkSummary: failedRequests.slice(-5).join('\n'),
          durationMs: Date.now() - testStarted,
          fingerprint: fp(screen.screen, t.id, String(e?.message)),
        });
      }
    }
  }

  await browser.close();
  return {
    results,
    diagnostics: {
      consoleErrorCount: consoleErrors.length,
      consoleWarningCount: consoleWarnings.length,
      consoleTop5: [...consoleErrors, ...consoleWarnings].slice(0, 5),
      network4xxCount: network4xx.length,
      network5xxCount: network5xx.length,
      failedRequestUrls: [...new Set([...network4xx, ...network5xx, ...failedRequests])].slice(0, 50),
    },
  };
}
