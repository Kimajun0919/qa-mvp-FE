import { chromium } from 'playwright';

export type ServiceType = 'LANDING' | 'LOGIN' | 'DASHBOARD' | 'MIXED';

export type PageRole = 'HOME' | 'PRICING' | 'DOCS' | 'BLOG' | 'SUPPORT' | 'LOGIN' | 'SIGNUP' | 'DASHBOARD' | 'CHECKOUT' | 'OTHER';

export interface DiscoveredPage {
  url: string;
  path: string;
  depth: number;
  title: string;
  httpStatus: number;
  isAuthLikely: boolean;
  authSignals?: string[];
  role: PageRole;
  priorityScore: number;
  priorityTier: 'P0' | 'P1' | 'P2' | 'P3';
}

export interface DiscoveredElement {
  pageUrl: string;
  kind: 'CTA' | 'FORM' | 'BUTTON' | 'MENU' | 'INPUT';
  selector: string;
  text?: string;
  href?: string;
  zone?: 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'CONTENT';
  score?: number;
  formType?: 'LOGIN' | 'SIGNUP' | 'CONTACT' | 'CHECKOUT' | 'SEARCH' | 'UNKNOWN';
}

export interface DiscoveryResult {
  baseUrl: string;
  origin: string;
  limits: { maxPages: number; maxDepth: number; hrefOnly: true; sameOriginOnly: true; ignoreRobots: true };
  pages: DiscoveredPage[];
  elements: DiscoveredElement[];
  serviceType: ServiceType;
  authLikely: boolean;
  metrics: {
    queued: number;
    crawled: number;
    uniquePathCount: number;
    ctaCount: number;
    menuCount: number;
    formCount: number;
    formTypeCounts: Record<string, number>;
    coverageScore: number;
    criticalPages: number;
    avgPriorityScore: number;
    authGatePages: number;
  };
}

function normalizeUrl(input: string, base: string) {
  const u = new URL(input, base);
  u.hash = '';

  // canonical query normalization: remove tracking params, stable order.
  const drop = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ref']);
  const keys = [...u.searchParams.keys()];
  for (const k of keys) {
    if (drop.has(k.toLowerCase())) u.searchParams.delete(k);
  }
  const kept = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  u.search = '';
  for (const [k, v] of kept) u.searchParams.append(k, v);

  // normalize trailing slash except root
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u;
}

export async function discoverSite(baseUrl: string, opts?: { maxPages?: number; maxDepth?: number }) {
  const maxPages = opts?.maxPages ?? 50;
  const maxDepth = opts?.maxDepth ?? 3;

  const origin = new URL(baseUrl).origin;
  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];

  const visitedUrl = new Set<string>();
  // Requirement: same path + query variations collapse to first path representative.
  const seenPath = new Set<string>();

  const pages: DiscoveredPage[] = [];
  const elements: DiscoveredElement[] = [];
  let queuedCount = 1;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;

      const normalized = normalizeUrl(current.url, baseUrl);
      if (normalized.origin !== origin) continue;
      if (visitedUrl.has(normalized.toString())) continue;

      const pathKey = normalized.pathname;
      if (seenPath.has(pathKey) && normalized.toString() !== baseUrl) {
        continue;
      }

      visitedUrl.add(normalized.toString());
      seenPath.add(pathKey);

      const page = await context.newPage();
      let httpStatus = 0;
      let title = '';
      let pageUrl = normalized.toString();
      let authLikely = false;
      let authSignals: string[] = [];

      try {
        const response = await page.goto(normalized.toString(), { waitUntil: 'domcontentloaded', timeout: 15000 });
        httpStatus = response?.status() ?? 0;
        pageUrl = page.url();
        title = await page.title();
        const pageRole = classifyPageRole(new URL(pageUrl, baseUrl).pathname, title);

        const hasPasswordInput = (await page.locator('input[type="password"]').count()) > 0;
        const loginKeyword = /login|signin|auth|account|dashboard|admin/.test(pageUrl.toLowerCase());
        const redirectedToLogin = response ? response.url().toLowerCase().includes('login') : false;
        const statusAuthGate = httpStatus === 401 || httpStatus === 403;
        const accessDeniedText = ((await page.locator('text=/access denied|forbidden|unauthorized|sign in required|members only/i').count()) ?? 0) > 0;

        const reqSignals: string[] = [];
        if (hasPasswordInput) reqSignals.push('password-input');
        if (loginKeyword) reqSignals.push('login-keyword');
        if (redirectedToLogin) reqSignals.push('redirect-to-login');
        if (statusAuthGate) reqSignals.push(`http-${httpStatus}`);
        if (accessDeniedText) reqSignals.push('access-denied-text');

        const strongSignals = reqSignals.filter((s) => s === 'password-input' || s === 'redirect-to-login' || s === 'http-401' || s === 'http-403');
        const weakSignals = reqSignals.filter((s) => s === 'login-keyword' || s === 'access-denied-text');

        authSignals = reqSignals;
        authLikely = strongSignals.length > 0 || weakSignals.length >= 2;

        const links = await page.$$eval('a[href]', (nodes) =>
          nodes
            .map((n) => ({ href: (n as HTMLAnchorElement).getAttribute('href') || '', text: (n.textContent || '').trim() }))
            .filter((x) => !!x.href),
        );

        const navMenus = await page.$$eval('header nav a[href], nav[aria-label] a[href], nav a[href]', (nodes) =>
          nodes.map((n) => ({ href: (n as HTMLAnchorElement).getAttribute('href') || '', text: (n.textContent || '').trim() })),
        );
        const footerMenus = await page.$$eval('footer a[href]', (nodes) =>
          nodes.map((n) => ({ href: (n as HTMLAnchorElement).getAttribute('href') || '', text: (n.textContent || '').trim() })),
        );
        const sideMenus = await page.$$eval('aside a[href]', (nodes) =>
          nodes.map((n) => ({ href: (n as HTMLAnchorElement).getAttribute('href') || '', text: (n.textContent || '').trim() })),
        );

        for (const m of navMenus.slice(0, 40)) elements.push({ pageUrl, kind: 'MENU', selector: 'nav a[href]', text: m.text, href: m.href, zone: 'HEADER' });
        for (const m of footerMenus.slice(0, 40)) elements.push({ pageUrl, kind: 'MENU', selector: 'footer a[href]', text: m.text, href: m.href, zone: 'FOOTER' });
        for (const m of sideMenus.slice(0, 20)) elements.push({ pageUrl, kind: 'MENU', selector: 'aside a[href]', text: m.text, href: m.href, zone: 'SIDEBAR' });

        const buttons = await page.$$eval('button, a[role="button"], a[class*="btn" i]', (nodes) =>
          nodes.map((n) => (n.textContent || '').trim()).filter(Boolean),
        );
        for (const b of buttons.slice(0, 80)) {
          const upper = b.toUpperCase();
          const isCTA = /START|TRY|SIGN|가입|시작|신청|문의|BUY|GET|BOOK|DEMO|CONTACT/.test(upper);
          const score = isCTA ? 0.9 : 0.4;
          const kind: DiscoveredElement['kind'] = isCTA ? 'CTA' : 'BUTTON';
          elements.push({ pageUrl, kind, selector: 'button', text: b, zone: 'CONTENT', score });
        }

        const forms = await page.$$eval('form', (nodes) =>
          nodes.map((n, i) => {
            const f = n as HTMLFormElement;
            const id = f.getAttribute('id') || '';
            const action = f.getAttribute('action') || '';
            const text = (f.textContent || '').trim().slice(0, 500);
            const inputs = Array.from(f.querySelectorAll('input'));
            const inputTypes = inputs.map((inp) => (inp.getAttribute('type') || 'text').toLowerCase());
            const inputNames = inputs.map((inp) => (inp.getAttribute('name') || '').toLowerCase()).filter(Boolean);
            const placeholders = inputs.map((inp) => (inp.getAttribute('placeholder') || '').toLowerCase()).filter(Boolean);
            const hasTextarea = f.querySelectorAll('textarea').length > 0;
            const buttonText = Array.from(f.querySelectorAll('button, input[type="submit"]'))
              .map((el) => ((el as HTMLButtonElement).textContent || (el as HTMLInputElement).value || '').trim())
              .join(' ')
              .slice(0, 120);
            return { index: i + 1, id, action, text, inputTypes, inputNames, placeholders, hasTextarea, buttonText };
          }),
        );

        for (const f of forms.slice(0, 20)) {
          const formType = classifyFormType(
            f.id,
            f.action,
            `${f.text} ${f.buttonText}`,
            f.inputTypes,
            f.inputNames,
            f.placeholders,
            f.hasTextarea,
            pageRole,
          );
          elements.push({ pageUrl, kind: 'FORM', selector: `form:nth-of-type(${f.index})`, zone: 'CONTENT', formType });
        }

        const inputCount = await page.locator('input, textarea, select').count();
        for (let i = 0; i < Math.min(inputCount, 50); i++) {
          elements.push({ pageUrl, kind: 'INPUT', selector: `input,textarea,select#${i + 1}`, zone: 'CONTENT' });
        }

        for (const l of links) {
          try {
            const nu = normalizeUrl(l.href, pageUrl);
            if (nu.origin !== origin) continue;
            if (nu.pathname === normalized.pathname) continue;
            if (current.depth + 1 <= maxDepth) {
              queue.push({ url: nu.toString(), depth: current.depth + 1 });
              queuedCount++;
            }
          } catch {
            // ignore invalid href
          }
        }
      } catch {
        // keep partial page record
      } finally {
        const pathName = new URL(pageUrl, baseUrl).pathname;
        const role = classifyPageRole(pathName, title);
        const { score, tier } = scorePagePriority(role, authLikely, current.depth, httpStatus);
        pages.push({
          url: pageUrl,
          path: pathName,
          depth: current.depth,
          title,
          httpStatus,
          isAuthLikely: authLikely,
          authSignals,
          role,
          priorityScore: score,
          priorityTier: tier,
        });
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const serviceType = classifyServiceType(pages, elements);
  const ctaCount = elements.filter((e) => e.kind === 'CTA').length;
  const menuCount = elements.filter((e) => e.kind === 'MENU').length;
  const formCount = elements.filter((e) => e.kind === 'FORM').length;
  const formTypeCounts = elements
    .filter((e) => e.kind === 'FORM')
    .reduce<Record<string, number>>((acc, e) => {
      const k = e.formType || 'UNKNOWN';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

  const coverageScore = Math.max(
    0,
    Math.min(
      100,
      Math.round((pages.length / maxPages) * 40 + (menuCount > 0 ? 20 : 0) + (ctaCount > 0 ? 20 : 0) + (formCount > 0 ? 10 : 0) + (Object.keys(formTypeCounts).length > 1 ? 10 : 0)),
    ),
  );

  const criticalPages = pages.filter((p) => p.priorityTier === 'P0' || p.priorityTier === 'P1').length;
  const avgPriorityScore = pages.length ? Math.round((pages.reduce((s, p) => s + p.priorityScore, 0) / pages.length) * 10) / 10 : 0;
  const authGatePages = pages.filter((p) => p.isAuthLikely).length;

  const result: DiscoveryResult = {
    baseUrl,
    origin,
    limits: { maxPages, maxDepth, hrefOnly: true, sameOriginOnly: true, ignoreRobots: true },
    pages,
    elements,
    serviceType,
    authLikely: pages.some((p) => p.isAuthLikely),
    metrics: {
      queued: queuedCount,
      crawled: pages.length,
      uniquePathCount: new Set(pages.map((p) => p.path)).size,
      ctaCount,
      menuCount,
      formCount,
      formTypeCounts,
      coverageScore,
      criticalPages,
      avgPriorityScore,
      authGatePages,
    },
  };
  return result;
}

function classifyServiceType(pages: DiscoveredPage[], elements: DiscoveredElement[]): ServiceType {
  const total = Math.max(1, pages.length);
  const authPages = pages.filter((p) => p.isAuthLikely);
  const authRatio = authPages.length / total;
  const strongAuthSignals = authPages.filter((p) => (p.authSignals || []).some((s) => s === 'password-input' || s === 'redirect-to-login' || s === 'http-401' || s === 'http-403')).length;

  const hasDashboardPath = pages.some((p) => p.role === 'DASHBOARD' || /dashboard|admin|workspace|console/i.test(p.path));
  const hasHomePage = pages.some((p) => p.role === 'HOME');
  const hasLoginLikePage = pages.some((p) => p.role === 'LOGIN' || p.role === 'SIGNUP');
  const ctaCount = elements.filter((e) => e.kind === 'CTA').length;
  const landingLikePages = pages.filter((p) => p.role === 'HOME' || p.role === 'PRICING' || p.role === 'DOCS' || p.role === 'BLOG').length;

  if (hasDashboardPath && strongAuthSignals >= 1) return 'DASHBOARD';

  // Explicit auth entrypoint discovered in crawl => likely mixed product surface.
  if (hasLoginLikePage && authPages.length >= 1) return 'MIXED';

  // LOGIN only when auth evidence is strong and broad enough.
  if ((strongAuthSignals >= 2 || authRatio >= 0.35) && ctaCount < 10 && landingLikePages < Math.ceil(total * 0.4)) {
    return 'LOGIN';
  }

  // Mixed if login-like pages exist together with substantial landing/docs pages.
  if (hasLoginLikePage && landingLikePages >= Math.ceil(total * 0.2)) return 'MIXED';

  // If there is at least one strong auth signal and multiple auth-gated pages, prefer MIXED.
  if (strongAuthSignals >= 1 && authPages.length >= 2) return 'MIXED';

  // LANDING when majority of pages are marketing/docs and auth is sparse.
  if ((landingLikePages >= Math.ceil(total * 0.5) || ctaCount >= 8) && authRatio < 0.3) {
    return 'LANDING';
  }

  // Low-CTA developer landing sites fallback
  if (authRatio < 0.15 && (landingLikePages >= Math.ceil(total * 0.25) || hasHomePage)) return 'LANDING';

  if (authRatio >= 0.25 && landingLikePages >= Math.ceil(total * 0.3)) return 'MIXED';
  return ctaCount >= 5 ? 'LANDING' : 'MIXED';
}

function classifyPageRole(pathName: string, title: string): PageRole {
  const s = `${pathName} ${title}`.toLowerCase();
  if (pathName === '/' || /home|welcome/.test(s)) return 'HOME';
  if (/pricing|plans|price/.test(s)) return 'PRICING';
  if (/docs|documentation|guide|api/.test(s)) return 'DOCS';
  if (/blog|news|article/.test(s)) return 'BLOG';
  if (/support|help|faq|contact/.test(s)) return 'SUPPORT';
  if (/login|signin|auth/.test(s)) return 'LOGIN';
  if (/signup|register|join/.test(s)) return 'SIGNUP';
  if (/dashboard|admin|workspace|console/.test(s)) return 'DASHBOARD';
  if (/checkout|cart|payment|billing/.test(s)) return 'CHECKOUT';
  return 'OTHER';
}

function scorePagePriority(role: PageRole, authLikely: boolean, depth: number, httpStatus: number) {
  let score = 30;
  if (role === 'CHECKOUT') score += 50;
  else if (role === 'LOGIN' || role === 'SIGNUP' || role === 'DASHBOARD') score += 40;
  else if (role === 'PRICING' || role === 'SUPPORT') score += 25;
  else if (role === 'HOME') score += 20;
  else if (role === 'DOCS') score += 15;

  if (authLikely) score += 10;
  if (depth <= 1) score += 10;
  if (httpStatus >= 400 && httpStatus < 600) score += 15; // broken but critical to inspect

  score = Math.max(0, Math.min(100, score));
  const tier: 'P0' | 'P1' | 'P2' | 'P3' = score >= 85 ? 'P0' : score >= 70 ? 'P1' : score >= 50 ? 'P2' : 'P3';
  return { score, tier };
}

function classifyFormType(
  id: string,
  action: string,
  text: string,
  inputTypes: string[],
  inputNames: string[],
  placeholders: string[],
  hasTextarea: boolean,
  pageRole: PageRole,
): 'LOGIN' | 'SIGNUP' | 'CONTACT' | 'CHECKOUT' | 'SEARCH' | 'UNKNOWN' {
  const s = `${id} ${action} ${text}`.toLowerCase();
  const hasPassword = inputTypes.includes('password');
  const hasEmail = inputTypes.includes('email');
  const hasSearchInput = inputTypes.includes('search');
  const hasQName = inputNames.some((n) => n === 'q' || n.includes('search') || n.includes('query'));
  const hasSearchPlaceholder = placeholders.some((p) => /search|검색|찾기/.test(p));

  // Role-aware high-confidence rules
  if (pageRole === 'CHECKOUT' || /checkout|payment|billing|card|결제|pay now|place order/.test(s)) return 'CHECKOUT';
  if (pageRole === 'LOGIN' && hasPassword) return 'LOGIN';

  // SEARCH requires stronger evidence to reduce over-classification.
  const searchSignals = [
    /\bsearch\b|검색|찾기/.test(s),
    hasSearchInput,
    hasQName,
    hasSearchPlaceholder,
    /global search|site search|repository search/.test(s),
  ].filter(Boolean).length;

  const contactSignals = [
    hasTextarea,
    /contact us|문의하기|고객센터|support request/.test(s),
    /message us|send message|문의 내용|연락처/.test(s),
    (/name|email|phone|message/.test(s) && !hasPassword),
  ].filter(Boolean).length;

  // Strong contact indicator
  if (hasTextarea) return 'CONTACT';

  // Role-aware bias
  if ((pageRole === 'DOCS' || pageRole === 'BLOG') && searchSignals >= 1 && contactSignals === 0) return 'SEARCH';
  if (pageRole === 'SUPPORT' && contactSignals >= 1) return 'CONTACT';

  // Prefer SEARCH if both are weakly matched (common on docs/search pages)
  if (searchSignals >= 2 && contactSignals <= 1) return 'SEARCH';
  if (contactSignals >= 2) return 'CONTACT';
  if (contactSignals >= 1 && searchSignals === 0 && hasEmail && !hasPassword) return 'CONTACT';

  const signupKeyword = /signup|sign up|register|create account|join|회원가입/.test(s);
  const loginKeyword = /login|log in|signin|sign in|auth|로그인/.test(s);

  // Auth forms require password + explicit auth intent to avoid false positives
  if (hasPassword && signupKeyword) return 'SIGNUP';
  if (hasPassword && loginKeyword) return 'LOGIN';

  // Optional conservative heuristic for auth
  if (hasPassword && hasEmail && /remember me|2fa|otp|verification/.test(s)) return 'LOGIN';

  // Fallback: if very search-like without auth/contact signals
  if (searchSignals >= 1 && !hasPassword && contactSignals === 0) return 'SEARCH';

  return 'UNKNOWN';
}
