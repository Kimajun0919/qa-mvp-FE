import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { TestResult } from '../types.js';
import type { DiscoveryResult } from '../discovery/crawler.js';

export type FlowCandidateInput = {
  id: string;
  name: string;
  platformType: 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'MIXED';
  confidence: number;
  status?: 'PROPOSED' | 'SELECTED' | 'REJECTED';
};

export type FlowDefinitionInput = {
  name: string;
  loginMode?: 'OFF' | 'OPTIONAL';
  steps: Array<{
    action: 'NAVIGATE' | 'CLICK' | 'TYPE' | 'ASSERT_VISIBLE' | 'ASSERT_URL' | 'WAIT';
    selector?: string;
    value?: string;
    targetUrl?: string;
    required?: boolean;
  }>;
};

const require = createRequire(import.meta.url);

export class ResultStore {
  db: any;
  constructor(dbPath = 'out/qa.sqlite') {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    try {
      const BetterSqlite3 = require('better-sqlite3');
      this.db = new BetterSqlite3(dbPath);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('NODE_MODULE_VERSION')) {
        throw new Error(
          `[DB_INIT_ERROR] better-sqlite3 ABI mismatch detected.\n` +
            `- Current Node.js version is incompatible with the installed native module.\n` +
            `- Fix: run \`npm rebuild better-sqlite3\` (or \`npm install\`) in workspace root, then restart.\n` +
            `- Original error: ${msg}`,
        );
      }
      throw e;
    }
  }

  migrate() {
    const files = ['migrations/001_init.sql', 'migrations/002_mvp_v1.sql'];
    for (const file of files) {
      const sql = readFileSync(file, 'utf-8');
      this.db.exec(sql);
    }
  }

  createRun(runId: string, startedAt: string) {
    this.db.prepare('INSERT INTO runs(runId, startedAt) VALUES(?, ?)').run(runId, startedAt);
  }

  finishRun(runId: string, finishedAt: string, summary: string) {
    this.db.prepare('UPDATE runs SET finishedAt=?, summary=? WHERE runId=?').run(finishedAt, summary, runId);
  }

  insertResult(r: TestResult) {
    this.db
      .prepare(`INSERT INTO results(runId,executedAt,screen,testId,status,severity,url,path,category,expected,actual,screenshotPath,htmlPath,tracePath,consoleErrorsCount,networkSummary,fingerprint)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        r.runId,
        r.executedAt,
        r.screen,
        r.testId,
        r.status,
        r.severity,
        r.url,
        r.path,
        r.category,
        r.expected,
        r.actual,
        r.screenshotPath ?? null,
        r.htmlPath ?? null,
        r.tracePath ?? null,
        r.consoleErrorsCount,
        r.networkSummary,
        r.fingerprint,
      );

    if (r.status === 'FAIL' || r.status === 'BLOCKED' || r.status === 'ERROR' || r.status === 'WARNING') {
      const existing = this.db.prepare('SELECT fingerprint,count FROM issues WHERE fingerprint=?').get(r.fingerprint) as any;
      if (existing) {
        this.db
          .prepare('UPDATE issues SET lastSeenAt=?, count=count+1, status=?, lastRunId=? WHERE fingerprint=?')
          .run(r.executedAt, r.status, r.runId, r.fingerprint);
      } else {
        this.db
          .prepare('INSERT INTO issues(fingerprint,firstSeenAt,lastSeenAt,count,status,lastRunId) VALUES(?,?,?,?,?,?)')
          .run(r.fingerprint, r.executedAt, r.executedAt, 1, r.status, r.runId);
      }
    }
  }

  failedResultsByRun(runId: string) {
    return this.db
      .prepare("SELECT * FROM results WHERE runId=? AND status IN ('FAIL','BLOCKED','ERROR') ORDER BY id ASC")
      .all(runId) as any[];
  }

  saveDiscovery(analysisId: string, data: DiscoveryResult) {
    this.db
      .prepare(
        `INSERT INTO analysis_runs(analysisId,baseUrl,origin,maxPages,maxDepth,status,startedAt,finishedAt)
         VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        analysisId,
        data.baseUrl,
        data.origin,
        data.limits.maxPages,
        data.limits.maxDepth,
        'DONE',
        new Date().toISOString(),
        new Date().toISOString(),
      );

    const insertPage = this.db.prepare(
      `INSERT OR IGNORE INTO pages(analysisId,url,path,depth,httpStatus,title,isAuthLikely)
       VALUES(?,?,?,?,?,?,?)`,
    );
    const insertElement = this.db.prepare(
      `INSERT INTO elements(analysisId,pageId,kind,selector,text,href)
       VALUES(?,?,?,?,?,?)`,
    );

    const pageIdByUrl = new Map<string, number>();
    for (const p of data.pages) {
      insertPage.run(analysisId, p.url, p.path, p.depth, p.httpStatus, p.title, p.isAuthLikely ? 1 : 0);
      const row = this.db.prepare('SELECT id FROM pages WHERE analysisId=? AND url=?').get(analysisId, p.url) as { id: number } | undefined;
      if (row) pageIdByUrl.set(p.url, row.id);
    }

    for (const e of data.elements) {
      const pageId = pageIdByUrl.get(e.pageUrl) ?? null;
      insertElement.run(analysisId, pageId, e.kind, e.selector, e.text ?? null, e.href ?? null);
    }
  }

  saveFlowCandidates(analysisId: string, candidates: FlowCandidateInput[]) {
    const q = this.db.prepare(
      `INSERT OR REPLACE INTO flow_candidates(id,analysisId,name,platformType,confidence,status,source)
       VALUES(?,?,?,?,?,?, 'AUTO')`,
    );
    for (const c of candidates) {
      q.run(c.id, analysisId, c.name, c.platformType, c.confidence, c.status ?? 'PROPOSED');
    }
  }

  getAnalysisBundle(analysisId: string) {
    const analysis = this.db.prepare('SELECT * FROM analysis_runs WHERE analysisId=?').get(analysisId);
    const pages = this.db.prepare('SELECT * FROM pages WHERE analysisId=? ORDER BY depth ASC, id ASC').all(analysisId);
    const elements = this.db.prepare('SELECT * FROM elements WHERE analysisId=? ORDER BY id ASC').all(analysisId);
    const candidates = this.db.prepare('SELECT * FROM flow_candidates WHERE analysisId=? ORDER BY confidence DESC').all(analysisId);
    return { analysis, pages, elements, candidates };
  }

  getFinalFlows(analysisId: string) {
    const analysis = this.db.prepare('SELECT * FROM analysis_runs WHERE analysisId=?').get(analysisId) as any;
    const flows = this.db
      .prepare('SELECT flowId,name,loginMode,isFinal FROM flow_definitions WHERE analysisId=? AND isFinal=1 ORDER BY createdAt ASC')
      .all(analysisId) as any[];

    const stepsQ = this.db.prepare(
      'SELECT id,flowId,stepOrder,action,selector,value,targetUrl,required FROM flow_steps WHERE flowId=? ORDER BY stepOrder ASC',
    );
    const withSteps = flows.map((f) => ({ ...f, steps: stepsQ.all(f.flowId) }));
    return { analysis, flows: withSteps };
  }

  saveFinalFlows(analysisId: string, flows: FlowDefinitionInput[]) {
    const now = new Date().toISOString();
    const insFlow = this.db.prepare(
      `INSERT INTO flow_definitions(flowId,analysisId,name,loginMode,createdBy,isFinal,createdAt,updatedAt)
       VALUES(?,?,?,?, 'USER',1,?,?)`,
    );
    const insStep = this.db.prepare(
      `INSERT INTO flow_steps(flowId,stepOrder,action,selector,value,targetUrl,required)
       VALUES(?,?,?,?,?,?,?)`,
    );

    const tx = this.db.transaction(() => {
      for (const f of flows) {
        const flowId = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        insFlow.run(flowId, analysisId, f.name, f.loginMode ?? 'OFF', now, now);
        f.steps.forEach((s, idx) => {
          insStep.run(flowId, idx + 1, s.action, s.selector ?? null, s.value ?? null, s.targetUrl ?? null, s.required === false ? 0 : 1);
        });
      }
    });
    tx();
  }
}
