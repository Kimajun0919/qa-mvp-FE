import type { DiscoveryResult } from '../discovery/crawler.js';
import type { FlowCandidateInput } from '../store/sqlite.js';
import { chatJson, type LLMOptions } from './client.js';

export type PlannerOutput = {
  candidates: FlowCandidateInput[];
  mode: 'llm' | 'heuristic';
  reason?: string;
};

export async function planFlowsFromDiscovery(input: DiscoveryResult, llmOptions?: LLMOptions): Promise<PlannerOutput> {
  try {
    const prompt = buildPrompt(input);
    const r = await chatJson({
      system:
        'You are a QA planner. Return JSON only. Output: {"candidates":[{"name":string,"platformType":"LANDING"|"LOGIN"|"DASHBOARD"|"MIXED","confidence":number}]}. Max 5 candidates.',
      user: prompt,
      options: { temperature: 0.2, ...llmOptions },
    });

    if (!r.ok) throw new Error(r.error);
    const parsed = JSON.parse(r.content || '{}');    const raw = Array.isArray(parsed?.candidates) ? parsed.candidates : [];

    const candidates: FlowCandidateInput[] = raw
      .slice(0, 5)
      .map((c: any, i: number) => ({
        id: `cand_${Date.now()}_${i}`,
        name: String(c?.name ?? `Auto Flow ${i + 1}`),
        platformType: normalizePlatform(String(c?.platformType ?? input.serviceType)),
        confidence: clamp(Number(c?.confidence ?? 0.7), 0, 1),
        status: 'PROPOSED',
      }));

    if (candidates.length === 0) throw new Error('empty llm candidates');
    return { candidates, mode: 'llm' };
  } catch (e: any) {
    return { candidates: heuristicCandidates(input), mode: 'heuristic', reason: e?.message ?? 'planner error' };
  }
}

function buildPrompt(input: DiscoveryResult) {
  const pages = input.pages.slice(0, 20).map((p) => ({ path: p.path, depth: p.depth, auth: p.isAuthLikely }));
  const elements = input.elements.slice(0, 40).map((e) => ({ kind: e.kind, text: (e.text || '').slice(0, 60), href: e.href || '' }));
  return JSON.stringify(
    {
      baseUrl: input.baseUrl,
      serviceType: input.serviceType,
      authLikely: input.authLikely,
      pages,
      elements,
      limits: input.limits,
      goal: 'Propose core user-flow QA candidates for MVP execution.',
    },
    null,
    2,
  );
}

function heuristicCandidates(input: DiscoveryResult): FlowCandidateInput[] {
  const out: FlowCandidateInput[] = [
    {
      id: `cand_${Date.now()}_landing`,
      name: '랜딩 진입 및 핵심 CTA 노출',
      platformType: input.serviceType,
      confidence: 0.9,
      status: 'PROPOSED',
    },
    {
      id: `cand_${Date.now()}_core`,
      name: '핵심 기능 진입/실행 가능 여부',
      platformType: input.serviceType,
      confidence: 0.8,
      status: 'PROPOSED',
    },
  ];

  if (input.authLikely || input.serviceType === 'LOGIN' || input.serviceType === 'DASHBOARD') {
    out.push({
      id: `cand_${Date.now()}_login`,
      name: '로그인 후 목표 페이지 도달',
      platformType: input.serviceType,
      confidence: 0.85,
      status: 'PROPOSED',
    });
  }

  return out;
}

function normalizePlatform(v: string): 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'MIXED' {
  const u = v.toUpperCase();
  if (u === 'LANDING' || u === 'LOGIN' || u === 'DASHBOARD' || u === 'MIXED') return u;
  return 'MIXED';
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
