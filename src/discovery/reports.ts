import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DiscoveryResult } from './crawler.js';

export type SitemapRow = {
  path: string;
  url: string;
  title: string;
  depth: number;
  role: string;
  httpStatus: number;
  authLikely: boolean;
  authSignals?: string[];
  priorityScore: number;
  priorityTier: 'P0' | 'P1' | 'P2' | 'P3';
};

export type MenuRow = {
  name: string;
  href: string;
  zone: 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'CONTENT';
  count: number;
  pages: string[];
  scope: 'GLOBAL' | 'LOCAL';
};

export function buildSitemapReport(discovery: DiscoveryResult) {
  const rows: SitemapRow[] = discovery.pages
    .map((p) => ({
      path: p.path,
      url: p.url,
      title: p.title,
      depth: p.depth,
      role: p.role,
      httpStatus: p.httpStatus,
      authLikely: p.isAuthLikely,
      authSignals: p.authSignals || [],
      priorityScore: p.priorityScore,
      priorityTier: p.priorityTier,
    }))
    .sort((a, b) => a.depth - b.depth || b.priorityScore - a.priorityScore || a.path.localeCompare(b.path));

  return {
    baseUrl: discovery.baseUrl,
    origin: discovery.origin,
    serviceType: discovery.serviceType,
    authLikely: discovery.authLikely,
    metrics: discovery.metrics,
    rows,
  };
}

export function buildMenuReport(discovery: DiscoveryResult) {
  const menuLike = discovery.elements.filter((e) => e.kind === 'MENU' && e.text && e.href);
  const map = new Map<string, MenuRow>();

  const normalizeName = (s: string) => s.replace(/\s+/g, ' ').trim();
  const normalizeHref = (h: string) => {
    try {
      const u = new URL(h, discovery.baseUrl);
      u.hash = '';
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
      return `${u.origin}${u.pathname}`;
    } catch {
      return h;
    }
  };

  const isNoiseName = (name: string) => {
    if (name.length < 2) return true;
    if (/^[\W_]+$/.test(name)) return true;
    if (/^(more|learn more|read more|go|next|prev)$/i.test(name)) return true;
    return false;
  };
  const isNoiseHref = (href: string) => {
    const h = href.toLowerCase();
    return h.startsWith('javascript:') || h.startsWith('mailto:') || h.endsWith('#') || h === '#';
  };

  for (const e of menuLike) {
    const name = normalizeName(e.text || '');
    if (!name || isNoiseName(name)) continue;
    const href = normalizeHref(e.href || '');
    if (!href || isNoiseHref(href)) continue;
    const zone = e.zone || 'CONTENT';
    const key = `${name.toLowerCase()}|${href}|${zone}`;

    if (!map.has(key)) {
      map.set(key, {
        name,
        href,
        zone,
        count: 0,
        pages: [],
        scope: 'LOCAL',
      });
    }
    const row = map.get(key)!;
    row.count += 1;
    if (!row.pages.includes(e.pageUrl)) row.pages.push(e.pageUrl);
  }

  const pageCount = Math.max(1, discovery.pages.length);
  const rows = [...map.values()].map((r) => {
    const ratio = r.pages.length / pageCount;
    const isGlobalZone = r.zone === 'HEADER' || r.zone === 'FOOTER';
    const isGlobal = isGlobalZone && ratio >= 0.4;
    return { ...r, scope: isGlobal ? 'GLOBAL' : 'LOCAL' };
  });

  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    baseUrl: discovery.baseUrl,
    totalMenus: rows.length,
    globalMenus: rows.filter((r) => r.scope === 'GLOBAL').length,
    localMenus: rows.filter((r) => r.scope === 'LOCAL').length,
    rows,
  };
}

function estimateFormPrecision(discovery: DiscoveryResult) {
  const forms = discovery.elements.filter((e) => e.kind === 'FORM');
  const total = forms.length;
  const byType = forms.reduce<Record<string, number>>((acc, f) => {
    const k = f.formType || 'UNKNOWN';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Heuristic confidence per form type (bootstrap baseline for PM monitoring)
  const weights: Record<string, number> = {
    LOGIN: 0.85,
    SIGNUP: 0.8,
    CONTACT: 0.72,
    CHECKOUT: 0.9,
    SEARCH: 0.7,
    UNKNOWN: 0.4,
  };

  let weighted = 0;
  for (const [k, c] of Object.entries(byType)) weighted += c * (weights[k] ?? 0.5);
  const precisionScore = total > 0 ? Math.round((weighted / total) * 100) : 0;
  const unknownRatio = total > 0 ? Math.round((byType.UNKNOWN || 0) / total * 100) : 0;

  const notes: string[] = [];
  if (unknownRatio > 50) notes.push('UNKNOWN 비율 높음: 폼 패턴 룰 추가 필요');
  if ((byType.LOGIN || 0) > 0 && (byType.SEARCH || 0) > (byType.LOGIN || 0) * 10) notes.push('SEARCH 편향 가능성 점검 필요');

  return { totalForms: total, byType, precisionScore, unknownRatio, notes };
}

export function buildQualityReport(discovery: DiscoveryResult, sitemap: ReturnType<typeof buildSitemapReport>, menu: ReturnType<typeof buildMenuReport>) {
  const m = discovery.metrics;
  const confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        m.coverageScore * 0.35 +
          (Math.min(1, m.uniquePathCount / Math.max(1, m.crawled)) * 100) * 0.15 +
          (Math.min(1, m.menuCount / Math.max(1, m.crawled * 10)) * 100) * 0.1 +
          (Math.min(1, m.ctaCount / Math.max(1, m.crawled)) * 100) * 0.1 +
          (Math.min(1, m.formCount / Math.max(1, m.crawled)) * 100) * 0.1 +
          (m.authGatePages > 0 ? 10 : 0) +
          (m.criticalPages > 0 ? 10 : 0),
      ),
    ),
  );

  const reasons: string[] = [
    `coverageScore=${m.coverageScore}`,
    `crawled=${m.crawled}, uniquePathCount=${m.uniquePathCount}`,
    `menus=${m.menuCount}, ctas=${m.ctaCount}, forms=${m.formCount}`,
    `authGatePages=${m.authGatePages}, criticalPages=${m.criticalPages}`,
  ];

  const formPrecision = estimateFormPrecision(discovery);

  const risks: string[] = [];
  if (m.authGatePages > 0) risks.push('인증/접근제한 구간 존재');
  if (m.criticalPages === 0) risks.push('P0/P1 핵심 경로 탐지 부족');
  if (menu.globalMenus === 0) risks.push('전역 메뉴 추출 부족 가능성');
  if (confidence < 70) risks.push('분석 신뢰도 보완 필요(추가 크롤링 권장)');
  if (formPrecision.unknownRatio > 50) risks.push('폼 분류 UNKNOWN 비율 높음');

  return {
    baseUrl: discovery.baseUrl,
    serviceType: discovery.serviceType,
    authLikely: discovery.authLikely,
    confidence,
    reasons,
    risks,
    metrics: m,
    formPrecision,
    topPriorityPages: sitemap.rows.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10),
    topGlobalMenus: menu.rows.filter((r) => r.scope === 'GLOBAL').slice(0, 10),
  };
}

export function writeAnalysisReports(analysisId: string, discovery: DiscoveryResult) {
  mkdirSync(path.join('out', 'report'), { recursive: true });

  const sitemap = buildSitemapReport(discovery);
  const menu = buildMenuReport(discovery);
  const quality = buildQualityReport(discovery, sitemap, menu);

  const sitemapPath = path.join('out', 'report', `analysis_${analysisId}_sitemap.json`);
  const menuPath = path.join('out', 'report', `analysis_${analysisId}_menu.json`);
  const qualityPath = path.join('out', 'report', `analysis_${analysisId}_quality.json`);

  writeFileSync(sitemapPath, JSON.stringify(sitemap, null, 2), 'utf-8');
  writeFileSync(menuPath, JSON.stringify(menu, null, 2), 'utf-8');
  writeFileSync(qualityPath, JSON.stringify(quality, null, 2), 'utf-8');

  return { sitemapPath, menuPath, qualityPath, sitemap, menu, quality };
}
