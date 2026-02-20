import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { discoverSite } from './crawler.js';

type Seed = {
  policy: string;
  sampleSize: number;
  sites: Array<{ url: string; expectedServiceType: string; notes?: string }>;
};

async function main() {
  const seed = JSON.parse(readFileSync('docs/DISCOVERY_EVAL_SEED.json', 'utf-8')) as Seed;
  const out: any[] = [];

  for (const s of seed.sites.slice(0, seed.sampleSize)) {
    const d = await discoverSite(s.url, { maxPages: 20, maxDepth: 2 });
    out.push({
      url: s.url,
      expectedServiceType: s.expectedServiceType,
      actualServiceType: d.serviceType,
      authLikely: d.authLikely,
      metrics: d.metrics,
      formTypeCounts: d.metrics.formTypeCounts,
      notes: s.notes || '',
      matched: s.expectedServiceType === d.serviceType,
    });
  }

  const accuracy = out.length ? Math.round((out.filter((x) => x.matched).length / out.length) * 100) : 0;
  const result = { policy: seed.policy, sampleSize: out.length, serviceTypeAccuracy: accuracy, rows: out };

  mkdirSync(path.join('out', 'report'), { recursive: true });
  const p = path.join('out', 'report', 'discovery_eval.json');
  writeFileSync(p, JSON.stringify(result, null, 2), 'utf-8');
  console.log(JSON.stringify({ ok: true, output: p, serviceTypeAccuracy: accuracy }, null, 2));
}

main();
