import { executeOnce } from './run_once.js';
import { startScheduler } from './scheduler.js';
import { discoverSite } from './discovery/crawler.js';
import { ResultStore } from './store/sqlite.js';

const cmd = process.argv[2] ?? 'run-once';

if (cmd === 'run-once') {
  const r = await executeOnce();
  console.log(JSON.stringify(r, null, 2));
} else if (cmd === 'daemon') {
  startScheduler();
} else if (cmd === 'report') {
  const r = await executeOnce();
  console.log(`report refreshed: ${JSON.stringify(r)}`);
} else if (cmd === 'analyze') {
  const url = process.argv[3];
  if (!url) {
    console.error('usage: tsx src/cli.ts analyze <url>');
    process.exit(1);
  }
  const data = await discoverSite(url, { maxPages: 50, maxDepth: 3 });
  const store = new ResultStore();
  store.migrate();
  const analysisId = `analysis_${Date.now()}`;
  store.saveDiscovery(analysisId, data);
  console.log(JSON.stringify({ analysisId, pages: data.pages.length, elements: data.elements.length, serviceType: data.serviceType, authLikely: data.authLikely }, null, 2));
} else {
  console.log('usage: npm run run-once | npm run daemon | tsx src/cli.ts analyze <url>');
  process.exit(1);
}
