import { chatJson, type LLMOptions } from './client.js';

type JudgeInput = {
  finalStatus: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  summary: Record<string, number | string>;
  issues: Array<{ status: string; actual?: string; networkSummary?: string }>;
  network: { total4xx: number; total5xx: number; failedUrls: string[] };
  console: { errorCount: number; warningCount: number; top5: string[] };
};

export type JudgeOutput = {
  mode: 'llm' | 'heuristic';
  topCause: 'Frontend' | 'Backend' | 'Network' | 'TestData' | 'Flaky' | 'Unknown';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  summary3Lines: string[];
  reason?: string;
};

export async function judgeRun(input: JudgeInput, llmOptions?: LLMOptions): Promise<JudgeOutput> {
  try {
    const r = await chatJson({
      system:
        'You are QA triage judge. Return JSON only: {"topCause":"Frontend|Backend|Network|TestData|Flaky|Unknown","priority":"P0|P1|P2|P3","summary3Lines":["...","...","..."]}',
      user: JSON.stringify(input).slice(0, 12000),
      options: { temperature: 0.1, ...llmOptions },
    });
    if (!r.ok) throw new Error(r.error);
    const parsed = JSON.parse(r.content || '{}');
    return {
      mode: 'llm',
      topCause: normalizeCause(parsed?.topCause),
      priority: normalizePriority(parsed?.priority),
      summary3Lines: normalizeLines(parsed?.summary3Lines),
    };
  } catch (e: any) {
    return heuristicJudge(input, e?.message ?? 'judge error');
  }
}

function heuristicJudge(input: JudgeInput, reason?: string): JudgeOutput {
  let topCause: JudgeOutput['topCause'] = 'Unknown';
  if (input.network.total5xx > 0 || input.network.total4xx > 3) topCause = 'Backend';
  else if (input.console.errorCount > 0) topCause = 'Frontend';
  else if (input.network.failedUrls.length > 0) topCause = 'Network';
  else if (input.issues.some((i) => /login|auth|credential|testid|selector/i.test(`${i.actual ?? ''}`))) topCause = 'TestData';

  let priority: JudgeOutput['priority'] = 'P3';
  if (input.finalStatus === 'FAIL') priority = 'P1';
  if (input.network.total5xx > 0) priority = 'P0';
  if (input.finalStatus === 'PASS_WITH_WARNINGS') priority = 'P2';

  return {
    mode: 'heuristic',
    topCause,
    priority,
    summary3Lines: [
      `Final=${input.finalStatus}, priority=${priority}, cause=${topCause}`,
      `network(4xx=${input.network.total4xx}, 5xx=${input.network.total5xx}), console(error=${input.console.errorCount}, warn=${input.console.warningCount})`,
      `issues=${input.issues.length}건, failedUrls=${input.network.failedUrls.length}건`,
    ],
    reason,
  };
}

function normalizeCause(v: any): JudgeOutput['topCause'] {
  const s = String(v ?? 'Unknown');
  if (['Frontend', 'Backend', 'Network', 'TestData', 'Flaky', 'Unknown'].includes(s)) return s as any;
  return 'Unknown';
}
function normalizePriority(v: any): JudgeOutput['priority'] {
  const s = String(v ?? 'P3');
  if (['P0', 'P1', 'P2', 'P3'].includes(s)) return s as any;
  return 'P3';
}
function normalizeLines(v: any): string[] {
  const arr = Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  while (arr.length < 3) arr.push('');
  return arr.slice(0, 3);
}
